/**
 * Como a pergunta chega até a Claude.
 *
 * Há dois caminhos, e a diferença entre eles é onde mora a chave da API:
 *
 *  • **Pelo servidor** (`edge`) — o caminho de produção. A chave fica no
 *    segredo da Edge Function `assistente`, no Supabase. O navegador manda a
 *    pergunta com o token de quem está logado e nunca vê a chave. É o único
 *    caminho que respeita o teto diário e deixa registro de custo.
 *
 *  • **Pelo navegador** (`navegador`) — para testar antes de publicar. Quem
 *    usa cola a própria chave, que fica guardada só naquele navegador. É
 *    cômodo e é arriscado: qualquer pessoa com acesso àquele computador lê a
 *    chave, e o gasto não passa por teto nenhum. A tela diz isso com todas as
 *    letras, e o padrão é desligado.
 *
 * Em qualquer um dos dois, a IA só devolve texto. Nada aqui grava em post,
 * pauta, roteiro, financeiro ou CRM.
 */

import type { AiRequest } from "../ai";
import { getDataService } from "./index";

export type AiMode = "edge" | "navegador" | "desligado";

export interface AiAnswerOk {
  ok: true;
  text: string;
  model: string;
  truncated?: boolean;
  usage?: { input_tokens: number | null; output_tokens: number | null };
}

export interface AiAnswerFail {
  ok: false;
  reason: string;
  message: string;
}

export type AiAnswer = AiAnswerOk | AiAnswerFail;

const LOCAL_KEY = "editorial-calendar:ia:v1";
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export interface LocalAiConfig {
  key: string;
  model: string;
  effort: "low" | "medium" | "high";
}

export const DEFAULT_MODEL = "claude-opus-5-5";

export function readLocalConfig(): LocalAiConfig | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalAiConfig>;
    if (!parsed.key) return null;
    return {
      key: parsed.key,
      model: parsed.model || DEFAULT_MODEL,
      effort: parsed.effort === "low" || parsed.effort === "high" ? parsed.effort : "medium",
    };
  } catch {
    return null;
  }
}

export function writeLocalConfig(config: LocalAiConfig | null): void {
  try {
    if (!config || !config.key.trim()) localStorage.removeItem(LOCAL_KEY);
    else localStorage.setItem(LOCAL_KEY, JSON.stringify(config));
  } catch {
    /* navegador sem armazenamento: o assistente simplesmente fica desligado */
  }
}

/** Qual caminho está disponível agora. */
export function aiMode(): AiMode {
  if (SUPABASE_URL && SUPABASE_ANON_KEY && getDataService().getSession()) return "edge";
  if (readLocalConfig()) return "navegador";
  return "desligado";
}

/** Mensagens em português para cada motivo que pode voltar. */
const MESSAGES: Record<string, string> = {
  desligado:
    "O assistente está desligado. Quem administra liga em Integrações → Assistente de IA.",
  sem_chave:
    "Falta a chave da Anthropic no servidor. Quem administra roda: supabase secrets set ANTHROPIC_API_KEY=...",
  chave_invalida: "A chave da Anthropic foi recusada. Confira se ela ainda é válida.",
  acao_nao_liberada: "Esta ação não está liberada na configuração do assistente.",
  limite_diario: "O teto de chamadas de hoje acabou. Ele volta a zero amanhã.",
  muitas_chamadas: "A Anthropic pediu para esperar um pouco. Tente de novo em instantes.",
  sem_permissao: "Faça login de novo: a sessão expirou.",
  banco_indisponivel: "Não consegui falar com o banco agora. Tente de novo.",
  pedido_grande_demais: "Há dado demais nesta tela para mandar de uma vez. Filtre e tente de novo.",
  recusa: "A IA preferiu não responder a este pedido. Tente reformular, ou siga sem ela.",
  falha_na_ia: "A chamada à IA falhou. Tente de novo em instantes.",
  sem_rede: "Sem conexão com a internet.",
};

function fail(reason: string, detail?: string): AiAnswerFail {
  return {
    ok: false,
    reason,
    message: detail || MESSAGES[reason] || "Não consegui falar com a IA agora.",
  };
}

/** Pelo servidor: a chave fica lá, o teto vale, o custo fica registrado. */
async function askViaEdge(request: AiRequest, clientId?: string | null): Promise<AiAnswer> {
  const service = getDataService();
  const token = service.accessToken?.() ?? null;
  if (!token) return fail("sem_permissao");

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/assistente`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: request.action,
        system: request.system,
        prompt: request.prompt,
        data: request.data,
        clientId: clientId ?? null,
      }),
    });
  } catch {
    return fail("sem_rede");
  }

  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    return fail("falha_na_ia");
  }

  if (body.ok === true && typeof body.text === "string") {
    return {
      ok: true,
      text: body.text,
      model: String(body.model ?? ""),
      truncated: body.truncated === true,
      usage: body.usage as AiAnswerOk["usage"],
    };
  }
  return fail(String(body.reason ?? "falha_na_ia"), body.message as string | undefined);
}

/** Pelo navegador: a chave é de quem está usando, e fica só ali. */
async function askViaBrowser(request: AiRequest): Promise<AiAnswer> {
  const config = readLocalConfig();
  if (!config) return fail("desligado");

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: config.key, dangerouslyAllowBrowser: true });
    const params = {
      model: config.model,
      max_tokens: 4000,
      output_config: { effort: config.effort },
      system: request.system,
      messages: [
        { role: "user" as const, content: `${request.prompt}\n\n${JSON.stringify(request.data)}` },
      ],
    };

    let message;
    try {
      message = await client.beta.messages.create({
        ...params,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (error) {
      // Mesma ideia da Edge Function: se a API recusar o resgate automático
      // de recusa, a pergunta segue sem ele em vez de falhar.
      if (!(error instanceof Anthropic.BadRequestError)) throw error;
      message = await client.messages.create(params);
    }

    if (message.stop_reason === "refusal") return fail("recusa");

    return {
      ok: true,
      text: message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim(),
      model: message.model || config.model,
      truncated: message.stop_reason === "max_tokens",
      usage: {
        input_tokens: message.usage.input_tokens ?? null,
        output_tokens: message.usage.output_tokens ?? null,
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/401|authentication|invalid x-api-key/i.test(detail)) return fail("chave_invalida");
    if (/429|rate.?limit/i.test(detail)) return fail("muitas_chamadas");
    return fail("falha_na_ia", `A chamada à IA falhou: ${detail.slice(0, 200)}`);
  }
}

/** O único ponto de entrada. A tela chama isto e mostra o que voltar. */
export async function askAi(
  request: AiRequest,
  clientId?: string | null,
): Promise<AiAnswer> {
  switch (aiMode()) {
    case "edge":
      return askViaEdge(request, clientId);
    case "navegador":
      return askViaBrowser(request);
    default:
      return fail("desligado");
  }
}
