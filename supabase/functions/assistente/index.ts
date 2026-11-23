// ============================================================================
//  Edge Function — assistente (ficha 22, com a crítica da ficha corrigida)
//
//  É aqui, e só aqui, que a chave da Anthropic existe. O navegador nunca a vê:
//  ele manda a pergunta já montada e já limpa (src/calendar-app/ai.ts), esta
//  função pergunta ao banco se pode gastar, chama a Claude e devolve o texto.
//
//  O QUE ESTA FUNÇÃO NÃO FAZ
//    Não escreve em nenhuma tabela do negócio. Procure: o único insert daqui
//    é em `ai_call`, que é o registro de uso. Nada que a IA responde vira dado
//    salvo sem uma pessoa clicar em "aplicar" na tela.
//
//  COMO PUBLICAR
//    supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//    supabase functions deploy assistente
//    (sem --no-verify-jwt: só quem está logado no painel pode chamar)
//
//  CUSTO
//    Cada chamada é cobrada pela Anthropic, por tamanho do texto. O teto diário
//    está em `ai_settings.daily_limit` e a conta de cada chamada fica em
//    `ai_call`. A tela de Integrações mostra os dois.
// ============================================================================

import Anthropic from "npm:@anthropic-ai/sdk@^1.12.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

/** As mesmas oito do catálogo em src/calendar-app/ai.ts. */
const ACTIONS = new Set([
  "resumo_do_dia",
  "sugerir_pautas",
  "escrever_legenda",
  "rascunhar_roteiro",
  "conclusoes_analise",
  "explicar_financeiro",
  "proximo_passo_crm",
  "resumo_formulario",
]);

/** Teto por resposta. Nenhuma das ações precisa de mais que isso. */
const MAX_TOKENS = 4000;
/** Teto do que entra, em caracteres. Acima disso é engano ou abuso. */
const MAX_INPUT_CHARS = 240_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** O `sub` do token. O Supabase já conferiu a assinatura antes de nos chamar. */
function userIdFrom(authorization: string | null): string | null {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4)));
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

/** Grava o uso. Falha aqui nunca derruba a resposta de quem perguntou. */
async function logCall(row: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ai_call`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch (error) {
    console.error("não consegui registrar a chamada:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, reason: "metodo" }, 405);

  const authorization = req.headers.get("Authorization");
  const userId = userIdFrom(authorization);

  if (!API_KEY) {
    return json(
      {
        ok: false,
        reason: "sem_chave",
        message:
          "O assistente ainda não tem chave da Anthropic. Quem administra precisa rodar: " +
          "supabase secrets set ANTHROPIC_API_KEY=...",
      },
      503,
    );
  }

  let body: {
    action?: string;
    system?: string;
    prompt?: string;
    data?: unknown;
    clientId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "corpo_invalido" }, 400);
  }

  const action = String(body.action ?? "");
  if (!ACTIONS.has(action)) {
    return json({ ok: false, reason: "acao_desconhecida" }, 400);
  }

  const prompt = String(body.prompt ?? "").trim();
  const system = String(body.system ?? "").trim();
  if (!prompt || !system) return json({ ok: false, reason: "pedido_incompleto" }, 400);

  const dataText = JSON.stringify(body.data ?? {});
  if (prompt.length + dataText.length > MAX_INPUT_CHARS) {
    return json({ ok: false, reason: "pedido_grande_demais" }, 413);
  }

  // 1. O banco decide se pode gastar. Roda com o token de quem pediu, para que
  //    a função só responda a quem está mesmo logado.
  let permission: { ok?: boolean; reason?: string; model?: string; effort?: string };
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ai_pode_chamar`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: authorization ?? `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_action: action }),
    });
    if (!response.ok) {
      return json({ ok: false, reason: "sem_permissao" }, 403);
    }
    permission = await response.json();
  } catch (error) {
    console.error("ai_pode_chamar falhou:", error);
    return json({ ok: false, reason: "banco_indisponivel" }, 503);
  }

  if (!permission?.ok) {
    return json({ ok: false, reason: permission?.reason ?? "desligado" }, 403);
  }

  const model = permission.model || "claude-opus-5-5";
  const effort = (permission.effort || "medium") as "low" | "medium" | "high";

  // 2. A chamada. `fallbacks: "default"` faz a própria API repetir o pedido em
  //    outro modelo quando o primeiro recusa por política — sem isso, uma
  //    recusa simplesmente volta vazia para quem perguntou.
  const client = new Anthropic({ apiKey: API_KEY });
  const params = {
    model,
    max_tokens: MAX_TOKENS,
    output_config: { effort },
    system,
    messages: [{ role: "user" as const, content: `${prompt}\n\n${dataText}` }],
  };

  try {
    let message;
    try {
      message = await client.beta.messages.create({
        ...params,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (error) {
      // Nem toda conta ou modelo aceita o resgate automático de recusa. Se a
      // API recusar o parâmetro, a chamada segue sem ele: perde-se o resgate,
      // não o assistente inteiro.
      if (!(error instanceof Anthropic.BadRequestError)) throw error;
      console.warn("fallbacks recusado pela API; repetindo sem ele:", error.message);
      message = await client.messages.create(params);
    }

    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();

    const refused = message.stop_reason === "refusal";
    const truncated = message.stop_reason === "max_tokens";

    await logCall({
      user_id: userId,
      action,
      client_id: body.clientId ?? null,
      model: message.model || model,
      input_tokens: message.usage.input_tokens ?? null,
      output_tokens: message.usage.output_tokens ?? null,
      ok: !refused,
      error: refused ? "recusa" : null,
    });

    if (refused) {
      return json({
        ok: false,
        reason: "recusa",
        message:
          "A IA preferiu não responder a este pedido. Tente reformular, ou siga sem ela.",
      });
    }

    return json({
      ok: true,
      text,
      truncated,
      model: message.model || model,
      usage: {
        input_tokens: message.usage.input_tokens ?? null,
        output_tokens: message.usage.output_tokens ?? null,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("chamada à Claude falhou:", detail);
    await logCall({
      user_id: userId,
      action,
      client_id: body.clientId ?? null,
      model,
      ok: false,
      error: detail.slice(0, 500),
    });
    const status =
      error instanceof Anthropic.AuthenticationError
        ? 502
        : error instanceof Anthropic.RateLimitError
          ? 429
          : 502;
    return json(
      {
        ok: false,
        reason:
          error instanceof Anthropic.AuthenticationError
            ? "chave_invalida"
            : error instanceof Anthropic.RateLimitError
              ? "muitas_chamadas"
              : "falha_na_ia",
        message: detail.slice(0, 300),
      },
      status,
    );
  }
});
