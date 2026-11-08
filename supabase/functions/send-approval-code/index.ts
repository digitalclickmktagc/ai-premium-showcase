/*
 * Edge Function — envia o código de verificação da aprovação externa.
 *
 * Por que ela existe: o Postgres não envia e-mail, e a função anônima
 * `issue_approval_code` descarta o código de propósito. Esta função é a única
 * porta por onde o código sai do banco: ela roda com a service_role, que não
 * existe no navegador, chama `issue_approval_code_delivery` (migração 004) e
 * entrega o código por e-mail. A resposta devolve apenas o destino mascarado.
 *
 * Implantação e variáveis: veja supabase/functions/README.md.
 *
 * Chamada sem JWT (--no-verify-jwt): quem decide é um cliente anônimo com o
 * link. A proteção não é o JWT, é o próprio banco — o token precisa existir, o
 * post precisa pertencer ao calendário daquele token, e há intervalo mínimo
 * entre pedidos, aplicado em SQL.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

interface Delivery {
  code: string;
  email: string | null;
  masked_email: string | null;
  client_name: string;
  post_title: string;
  calendar_name: string;
  expires_in_minutes: number;
}

function emailBody(d: Delivery) {
  const subject = `Seu código de confirmação: ${d.code}`;
  const text = [
    `Olá, ${d.client_name}.`,
    ``,
    `Para confirmar sua decisão sobre o post "${d.post_title}" (${d.calendar_name}),`,
    `use o código abaixo:`,
    ``,
    `    ${d.code}`,
    ``,
    `O código vale por ${d.expires_in_minutes} minutos e só pode ser usado uma vez.`,
    `Se não foi você que pediu, ignore esta mensagem — nada será registrado.`,
  ].join("\n");

  // HTML simples de propósito: cliente de e-mail não é navegador, e um
  // layout elaborado é o que costuma cair em spam ou quebrar no Outlook.
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16181d">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
    <tr><td>
      <p style="margin:0 0 16px;font-size:15px">Olá, ${escapeHtml(d.client_name)}.</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
        Para confirmar sua decisão sobre o post
        <strong>${escapeHtml(d.post_title)}</strong> (${escapeHtml(d.calendar_name)}),
        use o código abaixo:
      </p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px;background:#f2f3f7;border-radius:10px">${d.code}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#5b6071">
        O código vale por ${d.expires_in_minutes} minutos e só pode ser usado uma vez.
      </p>
      <p style="margin:0;font-size:13px;color:#5b6071">
        Se não foi você que pediu, ignore esta mensagem — nada será registrado.
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não suportado." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("APPROVAL_FROM_EMAIL");

  if (!supabaseUrl || !serviceKey) {
    console.error("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return json({ error: "Função mal configurada." }, 500);
  }
  if (!resendKey || !from) {
    // Dito com clareza: sem provedor, não há envio. Nada de fingir sucesso.
    return json(
      { error: "Envio de e-mail ainda não configurado nesta instalação." },
      501,
    );
  }

  let token = "";
  let postId = "";
  try {
    const body = await req.json();
    token = String(body.token ?? "");
    postId = String(body.postId ?? body.post_id ?? "");
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  if (!token || !postId) return json({ error: "Requisição inválida." }, 400);

  // 1. Pede o código ao banco (única porta que o devolve em claro).
  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/issue_approval_code_delivery`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: token, p_post_id: postId }),
  });

  if (!rpc.ok) {
    const raw = await rpc.text();
    let message = "Não foi possível gerar o código.";
    try {
      // As mensagens do banco já são voltadas ao usuário (link inválido,
      // post de outro calendário, intervalo mínimo) — vale repassá-las.
      message = JSON.parse(raw).message || message;
    } catch {
      /* mantém a mensagem genérica */
    }
    return json({ error: message }, rpc.status === 404 ? 400 : 400);
  }

  const delivery = (await rpc.json()) as Delivery;
  if (!delivery?.email) {
    return json(
      { error: "Este cliente não tem e-mail cadastrado. Fale com a agência." },
      400,
    );
  }

  // 2. Entrega.
  const { subject, text, html } = emailBody(delivery);
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [delivery.email],
      subject,
      text,
      html,
      ...(Deno.env.get("APPROVAL_REPLY_TO")
        ? { reply_to: Deno.env.get("APPROVAL_REPLY_TO") }
        : {}),
    }),
  });

  if (!send.ok) {
    // Nunca registramos o código, nem em erro.
    console.error("resend failed", send.status, await send.text());
    return json(
      { error: "Não foi possível enviar o e-mail agora. Tente de novo em instantes." },
      502,
    );
  }

  return json({ masked_email: delivery.masked_email, delivered: true });
});
