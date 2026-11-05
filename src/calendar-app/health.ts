import type { Client, ClientStatus, Post } from "./types";
import { approvalState, currentDecision } from "./approval";
import { todayISO } from "./utils";

export interface HealthSignal {
  key: string;
  label: string;
  /** Negative number: how many points this signal removed. */
  points: number;
}

export interface HealthScore {
  /** 0–100. */
  value: number;
  signals: HealthSignal[];
}

/**
 * Tunable signal weights (Spec 01 defaults, confirmed without changes).
 * `recebivel_vencido` is intentionally absent: there is no financial module
 * yet, so it could never fire and listing it would be misleading.
 */
export const HEALTH_RULES = {
  /** Each post still "to do" after its scheduled day. */
  overdueTask: { points: -5, max: -30 },
  /** Each review rejected in the last N days. */
  rejectedReview: { points: -10, max: -20, days: 30 },
  /** No client interaction for N days. */
  silence: { points: -15, days: 21 },
} as const;

const dayDiff = (fromISO: string, toISO: string): number =>
  Math.floor(
    (Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86_400_000,
  );

/** Last moment the client did something we can observe (an approval decision). */
export function lastClientInteraction(posts: Post[]): string | undefined {
  let latest: string | undefined;
  for (const p of posts) {
    for (const d of p.approval?.decisions ?? []) {
      if (!latest || d.at > latest) latest = d.at;
    }
  }
  return latest;
}

/**
 * Relationship health: `max(0, 100 + Σ weights of active signals)`.
 *
 * Returns the breakdown as well as the number, because the spec requires the
 * screen to show which signal removed what — a bare score nobody can explain
 * does not help anyone decide.
 */
export function clientHealth(
  posts: Post[],
  opts: { today?: string; clientCreatedAt?: string } = {},
): HealthScore {
  const today = opts.today ?? todayISO();
  const signals: HealthSignal[] = [];

  // 1. Overdue posts — scheduled in the past and still not done.
  const overdue = posts.filter((p) => p.status === "todo" && p.date < today);
  if (overdue.length > 0) {
    const raw = overdue.length * HEALTH_RULES.overdueTask.points;
    signals.push({
      key: "overdue",
      label: `${overdue.length} ${overdue.length === 1 ? "post atrasado" : "posts atrasados"}`,
      points: Math.max(raw, HEALTH_RULES.overdueTask.max),
    });
  }

  // 2. Reviews rejected recently.
  const rejected = posts.filter((p) => {
    if (approvalState(p.approval) !== "rejected") return false;
    const d = currentDecision(p.approval);
    if (!d) return false;
    return dayDiff(d.at.slice(0, 10), today) <= HEALTH_RULES.rejectedReview.days;
  });
  if (rejected.length > 0) {
    const raw = rejected.length * HEALTH_RULES.rejectedReview.points;
    signals.push({
      key: "rejected",
      label: `${rejected.length} ${rejected.length === 1 ? "reprovação" : "reprovações"} nos últimos ${HEALTH_RULES.rejectedReview.days} dias`,
      points: Math.max(raw, HEALTH_RULES.rejectedReview.max),
    });
  }

  // 3. Silence — measured from the last decision, or from when the client was
  //    created if they have never interacted.
  const last = lastClientInteraction(posts) ?? opts.clientCreatedAt;
  if (last) {
    const days = dayDiff(last.slice(0, 10), today);
    if (days >= HEALTH_RULES.silence.days) {
      signals.push({
        key: "silence",
        label: `Sem interação há ${days} dias`,
        points: HEALTH_RULES.silence.points,
      });
    }
  }

  const value = Math.max(0, 100 + signals.reduce((sum, s) => sum + s.points, 0));
  return { value, signals };
}

/** Colour band for the score, so the list reads at a glance. */
export function healthTone(value: number): { label: string; color: string } {
  if (value >= 80) return { label: "Saudável", color: "#22c55e" };
  if (value >= 50) return { label: "Atenção", color: "#f59e0b" };
  return { label: "Crítico", color: "#ef4444" };
}

// ── Lifecycle ────────────────────────────────────────────────
export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  active: "Ativo",
  paused: "Pausado",
  ended: "Encerrado",
  archived: "Arquivado",
};

/** Allowed transitions (Spec 01 §3). */
const TRANSITIONS: Record<ClientStatus, ClientStatus[]> = {
  active: ["paused", "ended", "archived"],
  paused: ["active", "ended", "archived"],
  ended: ["active", "archived"],
  archived: ["active"],
};

export function canTransition(from: ClientStatus, to: ClientStatus): boolean {
  return from === to || (TRANSITIONS[from]?.includes(to) ?? false);
}

/** Statuses that still take part in day-to-day work. */
export function isOperational(status: ClientStatus): boolean {
  return status === "active" || status === "paused";
}

/** Back-compat: older records stored only the `active` boolean. */
export function normalizeStatus(client: Partial<Client>): ClientStatus {
  if (client.status) return client.status;
  return client.active === false ? "paused" : "active";
}
