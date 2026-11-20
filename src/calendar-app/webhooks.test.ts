import { describe, expect, it } from "vitest";
import {
  BACKOFF_SECONDS,
  EVENT_IDS,
  MAX_ATTEMPTS,
  applyAttempt,
  buildPayload,
  dueDeliveries,
  newDelivery,
  newSecret,
  newSubscription,
  scheduleRetry,
  shouldDisable,
  signPayload,
  subscribersOf,
  subscriptionHealth,
  validateSubscription,
} from "./webhooks";
import type { WebhookDelivery, WebhookSubscription } from "./types";

const NOW = "2026-10-01T10:00:00.000Z";

function sub(over: Partial<WebhookSubscription> = {}): WebhookSubscription {
  return {
    ...newSubscription("https://exemplo.com/hook", ["post.aprovado"], NOW, "h1"),
    ...over,
  };
}

function delivery(over: Partial<WebhookDelivery> = {}): WebhookDelivery {
  return { ...newDelivery("h1", "post.aprovado", { postId: "p1" }, NOW, "d1"), ...over };
}

describe("validateSubscription", () => {
  it("accepts an https address with an event and a long secret", () => {
    expect(validateSubscription(sub())).toBeNull();
  });

  it("refuses http, because a webhook carries business facts", () => {
    expect(validateSubscription(sub({ url: "http://exemplo.com/hook" }))).toMatch(/https/);
  });

  it("refuses an address the server cannot reach", () => {
    expect(validateSubscription(sub({ url: "https://localhost/hook" }))).toMatch(/interno/);
    expect(validateSubscription(sub({ url: "https://192.168.0.10/hook" }))).toMatch(/interno/);
  });

  it("refuses nonsense, no event, or a short secret", () => {
    expect(validateSubscription(sub({ url: "não é url" }))).toMatch(/inválido/);
    expect(validateSubscription(sub({ events: [] }))).toMatch(/evento/);
    expect(validateSubscription(sub({ secret: "curto" }))).toMatch(/16/);
  });

  it("refuses an event nobody publishes", () => {
    expect(
      validateSubscription(sub({ events: ["post.inventado" as never] })),
    ).toMatch(/desconhecido/);
  });

  it("generates a secret long enough that guessing is not a strategy", () => {
    const secret = newSecret();
    expect(secret).toHaveLength(48);
    expect(newSecret()).not.toBe(secret);
  });
});

describe("subscribersOf", () => {
  it("picks the active subscriptions that asked for the event", () => {
    const list = [
      sub({ id: "a" }),
      sub({ id: "b", events: ["proposta.aceita"] }),
      sub({ id: "c", active: false }),
    ];
    expect(subscribersOf(list, "post.aprovado").map((s) => s.id)).toEqual(["a"]);
  });
});

describe("buildPayload", () => {
  it("carries ids and facts, with the event and its moment", () => {
    const payload = buildPayload("post.aprovado", { postId: "p1", calendarId: "c1" }, NOW, "e1");
    expect(payload).toEqual({
      id: "e1",
      event: "post.aprovado",
      at: NOW,
      data: { postId: "p1", calendarId: "c1" },
    });
  });

  it("publishes every event the catalogue lists", () => {
    expect(EVENT_IDS).toContain("contrato.assinado");
    expect(EVENT_IDS).toHaveLength(7);
  });
});

describe("signPayload", () => {
  it("signs the exact body, in hex, with the sha256 prefix", async () => {
    const signature = await signPayload("segredo-de-teste-1234", '{"a":1}');
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("changes when the body changes", async () => {
    const a = await signPayload("segredo-de-teste-1234", '{"a":1}');
    const b = await signPayload("segredo-de-teste-1234", '{"a":2}');
    expect(a).not.toBe(b);
  });

  it("changes when the secret changes", async () => {
    const a = await signPayload("segredo-de-teste-1234", '{"a":1}');
    const b = await signPayload("outro-segredo-de-teste", '{"a":1}');
    expect(a).not.toBe(b);
  });

  it("is stable for the same body and secret", async () => {
    const a = await signPayload("segredo-de-teste-1234", '{"a":1}');
    const b = await signPayload("segredo-de-teste-1234", '{"a":1}');
    expect(a).toBe(b);
  });
});

describe("retries", () => {
  const start = new Date("2026-10-01T10:00:00.000Z");

  it("marks a 2xx as delivered and stops", () => {
    const out = applyAttempt(delivery(), { status: 204 }, start);
    expect(out).toMatchObject({ status: "entregue", attempts: 1, responseStatus: 204 });
    expect(out.nextAttemptAt).toBeUndefined();
  });

  it("backs off further on each failure", () => {
    let d = delivery();
    d = applyAttempt(d, { status: 500 }, start);
    expect(d.status).toBe("pendente");
    expect(d.nextAttemptAt).toBe("2026-10-01T10:01:00.000Z");
    d = applyAttempt(d, { status: 500 }, new Date("2026-10-01T10:01:00.000Z"));
    expect(d.nextAttemptAt).toBe("2026-10-01T10:06:00.000Z");
  });

  it("gives up after the last attempt instead of hammering forever", () => {
    let d = delivery();
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) d = applyAttempt(d, { status: 500 }, start);
    expect(d.attempts).toBe(MAX_ATTEMPTS);
    expect(d.status).toBe("falhou");
    expect(d.nextAttemptAt).toBeUndefined();
    expect(BACKOFF_SECONDS).toHaveLength(MAX_ATTEMPTS);
  });

  it("records a transport error with no status", () => {
    const out = applyAttempt(delivery(), { error: "timeout" }, start);
    expect(out.error).toBe("timeout");
    expect(out.status).toBe("pendente");
  });

  it("says there is no retry left", () => {
    expect(scheduleRetry(delivery({ attempts: MAX_ATTEMPTS - 1 }), start)).toBeNull();
  });
});

describe("dueDeliveries", () => {
  it("takes what is pending and due, oldest first", () => {
    const list = [
      delivery({ id: "later", nextAttemptAt: "2026-10-01T11:00:00.000Z" }),
      delivery({ id: "due", nextAttemptAt: "2026-10-01T09:00:00.000Z", createdAt: "2026-10-01T08:00:00.000Z" }),
      delivery({ id: "done", status: "entregue" }),
      delivery({ id: "dead", status: "falhou" }),
    ];
    expect(dueDeliveries(list, NOW).map((d) => d.id)).toEqual(["due"]);
  });
});

describe("subscriptionHealth", () => {
  const deliveries = [
    delivery({ id: "a", status: "entregue" }),
    delivery({ id: "b", status: "falhou", error: "HTTP 500", createdAt: "2026-10-02T10:00:00.000Z" }),
    delivery({ id: "c", status: "pendente" }),
    delivery({ id: "d", subscriptionId: "outra", status: "falhou" }),
  ];

  it("counts only its own deliveries and reports the last error", () => {
    const health = subscriptionHealth("h1", deliveries);
    expect(health).toMatchObject({ total: 3, delivered: 1, failed: 1, pending: 1, rate: 50 });
    expect(health.lastError).toBe("HTTP 500");
  });

  it("has no rate before anything was attempted", () => {
    expect(subscriptionHealth("h1", [delivery({ status: "pendente" })]).rate).toBeNull();
  });

  it("suggests turning off an endpoint that only ever fails", () => {
    const failures = Array.from({ length: 5 }, (_, i) =>
      delivery({ id: `f${i}`, status: "falhou" }),
    );
    expect(shouldDisable(subscriptionHealth("h1", failures))).toBe(true);
    expect(shouldDisable(subscriptionHealth("h1", deliveries))).toBe(false);
  });
});
