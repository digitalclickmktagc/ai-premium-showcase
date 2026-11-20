import type {
  WebhookDelivery,
  WebhookEvent,
  WebhookSubscription,
} from "./types";
import { uid } from "./utils";

/**
 * Webhooks de saída (benchmark ficha 22, item F22).
 *
 * The design decisions worth stating, because they are the difference
 * between a webhook that can be trusted and one that cannot:
 *
 *   • **The database decides what happened, not the browser.** Deliveries
 *     are enqueued by triggers on the tables themselves, so an event fires
 *     whether it came from this app, from a client's public link or from
 *     someone editing a row by hand.
 *   • **The payload carries ids and facts, never internal text.** No
 *     `internalNotes`, no client e-mail, no card comments. Whoever receives
 *     the event can ask the API for what they are allowed to see.
 *   • **Every delivery is signed** (HMAC-SHA256 over the exact body), so the
 *     receiver can tell our POST from anyone else's.
 *   • **Retries back off and then stop.** A dead endpoint is disabled after
 *     the last attempt instead of being hammered forever.
 */

export const EVENTS: { id: WebhookEvent; label: string; description: string }[] = [
  { id: "post.aprovado", label: "Post aprovado", description: "O cliente aprovou um card." },
  {
    id: "post.ajuste_pedido",
    label: "Post com ajuste pedido",
    description: "O cliente pediu alteração em um card.",
  },
  { id: "post.publicado", label: "Post publicado", description: "Um card foi para o ar." },
  {
    id: "proposta.aceita",
    label: "Proposta aceita",
    description: "Uma proposta foi aceita no link público.",
  },
  {
    id: "contrato.assinado",
    label: "Contrato assinado",
    description: "Todas as partes assinaram e o contrato entrou em vigor.",
  },
  {
    id: "financeiro.liquidado",
    label: "Lançamento liquidado",
    description: "Uma conta foi paga ou um recebimento caiu.",
  },
  {
    id: "agendamento.criado",
    label: "Agendamento criado",
    description: "Alguém marcou um horário pelo link de agendamento.",
  },
];

export const EVENT_IDS = EVENTS.map((e) => e.id);

/** Attempts, and how long to wait before each retry (seconds). */
export const BACKOFF_SECONDS = [0, 60, 300, 1800, 7200];
export const MAX_ATTEMPTS = BACKOFF_SECONDS.length;

export function validateSubscription(sub: WebhookSubscription): string | null {
  const url = sub.url.trim();
  if (!url) return "Informe o endereço que vai receber os eventos.";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Endereço inválido.";
  }
  // https only: a webhook carries business facts, and http would put them on
  // the wire for anyone on the path to read.
  if (parsed.protocol !== "https:") return "O endereço precisa ser https.";
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/i.test(parsed.hostname))
    return "Endereço interno não é alcançável do servidor.";
  if (sub.events.length === 0) return "Escolha ao menos um evento.";
  if (sub.events.some((e) => !EVENT_IDS.includes(e))) return "Evento desconhecido.";
  if (!sub.secret || sub.secret.length < 16) return "O segredo precisa de pelo menos 16 caracteres.";
  return null;
}

/** A secret long enough that guessing it is not a strategy. */
export function newSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newSubscription(
  url = "",
  events: WebhookEvent[] = [],
  now = new Date().toISOString(),
  id: string = uid("hook"),
): WebhookSubscription {
  return {
    id,
    url,
    events,
    secret: newSecret(),
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** The body of an event. Ids and facts only — never internal text. */
export function buildPayload(
  event: WebhookEvent,
  data: Record<string, unknown>,
  now = new Date().toISOString(),
  id: string = uid("evt"),
): Record<string, unknown> {
  return {
    id,
    event,
    at: now,
    data,
  };
}

/**
 * The signature header: `sha256=<hex>` over the exact body that is sent.
 * The receiver recomputes it with the shared secret; anything that does not
 * match did not come from us.
 */
export async function signPayload(secret: string, body: string): Promise<string> {
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

export function subscribersOf(
  subscriptions: WebhookSubscription[],
  event: WebhookEvent,
): WebhookSubscription[] {
  return subscriptions.filter((s) => s.active && s.events.includes(event));
}

export function newDelivery(
  subscriptionId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
  now = new Date().toISOString(),
  id: string = uid("dlv"),
): WebhookDelivery {
  return {
    id,
    subscriptionId,
    event,
    payload,
    status: "pendente",
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
  };
}

/** When the next attempt is due, or null when there is none left. */
export function scheduleRetry(delivery: WebhookDelivery, now = new Date()): string | null {
  const next = delivery.attempts + 1;
  if (next >= MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + BACKOFF_SECONDS[next] * 1000).toISOString();
}

/** The delivery after an attempt. 2xx is success; anything else is a retry. */
export function applyAttempt(
  delivery: WebhookDelivery,
  result: { status?: number; error?: string },
  now = new Date(),
): WebhookDelivery {
  const attempts = delivery.attempts + 1;
  const ok = !!result.status && result.status >= 200 && result.status < 300;
  if (ok) {
    return {
      ...delivery,
      attempts,
      status: "entregue",
      responseStatus: result.status,
      error: undefined,
      nextAttemptAt: undefined,
      deliveredAt: now.toISOString(),
    };
  }
  const nextAttemptAt = scheduleRetry({ ...delivery, attempts: attempts - 1 }, now);
  return {
    ...delivery,
    attempts,
    status: nextAttemptAt ? "pendente" : "falhou",
    responseStatus: result.status,
    error: result.error ?? (result.status ? `HTTP ${result.status}` : "sem resposta"),
    nextAttemptAt: nextAttemptAt ?? undefined,
  };
}

/** Deliveries due now, oldest first. */
export function dueDeliveries(
  deliveries: WebhookDelivery[],
  now = new Date().toISOString(),
): WebhookDelivery[] {
  return deliveries
    .filter((d) => d.status === "pendente" && (d.nextAttemptAt ?? d.createdAt) <= now)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface SubscriptionHealth {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  /** Percent delivered of what was attempted; null when nothing was tried. */
  rate: number | null;
  lastError?: string;
}

export function subscriptionHealth(
  subscriptionId: string,
  deliveries: WebhookDelivery[],
): SubscriptionHealth {
  const own = deliveries.filter((d) => d.subscriptionId === subscriptionId);
  const delivered = own.filter((d) => d.status === "entregue").length;
  const failed = own.filter((d) => d.status === "falhou").length;
  const settled = delivered + failed;
  return {
    total: own.length,
    delivered,
    failed,
    pending: own.filter((d) => d.status === "pendente").length,
    rate: settled === 0 ? null : Math.round((delivered / settled) * 100),
    lastError: own
      .filter((d) => d.error)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.error,
  };
}

/**
 * A subscription that only fails is turned off, and the screen says why.
 * Hammering a dead endpoint forever is how an agency gets its IP blocked.
 */
export function shouldDisable(health: SubscriptionHealth, minimum = 5): boolean {
  return health.total >= minimum && health.delivered === 0 && health.failed >= minimum;
}
