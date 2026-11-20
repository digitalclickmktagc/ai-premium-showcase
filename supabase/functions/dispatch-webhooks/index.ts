// ============================================================================
//  Edge Function — dispatch-webhooks (ficha 22, F22)
//
//  Lê a fila `webhook_delivery`, entrega cada evento pendente com assinatura
//  HMAC-SHA256 e grava o resultado. Reentrante: pega um lote, entrega, marca.
//
//  COMO PUBLICAR E AGENDAR
//    supabase functions deploy dispatch-webhooks --no-verify-jwt
//    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...   # já existe no projeto
//    -- e um agendamento a cada minuto (pg_cron no projeto Supabase):
//    select cron.schedule('webhooks', '* * * * *', $$
//      select net.http_post(
//        url := 'https://<project>.supabase.co/functions/v1/dispatch-webhooks',
//        headers := jsonb_build_object('Authorization', 'Bearer <anon key>'))
//    $$);
//
//  ENQUANTO ISSO NÃO EXISTIR, A FILA SÓ CRESCE. A tela de integrações diz
//  isso em português, porque promessa de entrega que não entrega é pior que
//  não ter webhook nenhum.
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Backoff em segundos por tentativa — o mesmo de src/calendar-app/webhooks.ts. */
const BACKOFF_SECONDS = [0, 60, 300, 1800, 7200];
const MAX_ATTEMPTS = BACKOFF_SECONDS.length;
const BATCH = 25;
/** Um endpoint lento não pode segurar a fila inteira. */
const TIMEOUT_MS = 10_000;

async function sign(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `sha256=${[...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async () => {
  const now = new Date();
  const query =
    `webhook_delivery?status=eq.pendente&next_attempt_at=lte.${now.toISOString()}` +
    `&select=*,webhook_subscription(url,secret,active)&order=created_at.asc&limit=${BATCH}`;
  const pending = await (await rest(query)).json();

  let delivered = 0;
  let failed = 0;

  for (const row of pending as any[]) {
    const sub = row.webhook_subscription;
    // Assinatura desligada ou apagada: a entrega morre aqui, sem tentativa.
    if (!sub?.active) {
      await rest(`webhook_delivery?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "falhou",
          error: "assinatura desligada",
          next_attempt_at: null,
        }),
      });
      failed += 1;
      continue;
    }

    const body = JSON.stringify(row.payload);
    const signature = await sign(sub.secret, body);
    const attempts = row.attempts + 1;

    let status: number | undefined;
    let error: string | undefined;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const response = await fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Orkestrya-Event": row.event,
          "X-Orkestrya-Delivery": row.id,
          "X-Orkestrya-Signature": signature,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      status = response.status;
    } catch (err) {
      error = err instanceof Error ? err.message : "falha de rede";
    }

    const ok = !!status && status >= 200 && status < 300;
    const hasRetry = attempts < MAX_ATTEMPTS;
    const patch = ok
      ? {
          status: "entregue",
          attempts,
          response_status: status,
          error: null,
          next_attempt_at: null,
          delivered_at: new Date().toISOString(),
        }
      : {
          status: hasRetry ? "pendente" : "falhou",
          attempts,
          response_status: status ?? null,
          error: error ?? `HTTP ${status}`,
          next_attempt_at: hasRetry
            ? new Date(Date.now() + BACKOFF_SECONDS[attempts] * 1000).toISOString()
            : null,
        };

    await rest(`webhook_delivery?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    if (ok) delivered += 1;
    else failed += 1;
  }

  return new Response(
    JSON.stringify({ picked: (pending as any[]).length, delivered, failed }),
    { headers: { "Content-Type": "application/json" } },
  );
});
