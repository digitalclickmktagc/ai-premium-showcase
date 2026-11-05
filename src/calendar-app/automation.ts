import type { ApprovalResult, Post, PostStatus } from "./types";
import { currentDecision } from "./approval";
import { statusConfig } from "./status";

/**
 * Stage automations (Spec 02 §2).
 *
 * Triggers and actions are stored as data and interpreted by the engine, so a
 * new rule never means new code at the call sites.
 *
 * Only the triggers and actions this system can actually honour are offered.
 * The spec also lists assigning people, labels and checklists; none of those
 * exist here yet, and listing them would promise behaviour that never fires.
 */
export type AutomationTrigger =
  | { type: "entered_stage"; stage: PostStatus }
  | { type: "review_decided"; result: ApprovalResult };

export type AutomationAction =
  | { type: "move_to_stage"; stage: PostStatus }
  | { type: "send_for_review"; message?: string }
  | { type: "set_due_in_days"; days: number };

export interface AutomationRule {
  id: string;
  /** Scoped to one calendar (the spec's "quadro"). */
  calendarId: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  active: boolean;
  createdAt: string;
}

/** Insert-only execution log (the spec's `execucao_regra`). */
export interface AutomationRun {
  id: string;
  ruleId: string;
  postId: string;
  at: string;
  result: "applied" | "skipped" | "failed";
  detail?: string;
  /**
   * Identifies the event that caused this run, so the same event can never be
   * honoured twice. A client's decision is taken in their own browser, where
   * nothing may touch the calendar; the admin app catches up afterwards, and
   * this key is what tells it which decisions it has already acted on.
   */
  eventKey?: string;
}

export type AutomationEvent =
  | { kind: "entered_stage"; calendarId: string; postId: string; stage: PostStatus }
  | {
      kind: "review_decided";
      calendarId: string;
      postId: string;
      result: ApprovalResult;
    };

/** Rules whose trigger matches the event, in creation order. */
export function matchRules(
  event: AutomationEvent,
  rules: AutomationRule[],
): AutomationRule[] {
  return rules.filter((r) => {
    if (!r.active || r.calendarId !== event.calendarId) return false;
    if (event.kind === "entered_stage") {
      return r.trigger.type === "entered_stage" && r.trigger.stage === event.stage;
    }
    return r.trigger.type === "review_decided" && r.trigger.result === event.result;
  });
}

/**
 * How deep a chain of automations may go.
 *
 * An action can raise a new event ("moved to Feito" → a rule on Feito), so two
 * rules pointing at each other would loop forever. The chain stops at this
 * depth, and a rule never runs twice in the same chain.
 */
export const MAX_CHAIN_DEPTH = 5;

export interface ChainGuard {
  depth: number;
  firedRuleIds: Set<string>;
}

export function newChain(): ChainGuard {
  return { depth: 0, firedRuleIds: new Set() };
}

/** Whether this rule may still run in the current chain, and why not. */
export function canFire(
  rule: AutomationRule,
  guard: ChainGuard,
): { ok: true } | { ok: false; reason: string } {
  if (guard.depth >= MAX_CHAIN_DEPTH) {
    return { ok: false, reason: `Limite de ${MAX_CHAIN_DEPTH} automações encadeadas.` };
  }
  if (guard.firedRuleIds.has(rule.id)) {
    return { ok: false, reason: "Regra já aplicada nesta cadeia." };
  }
  return { ok: true };
}

// ── Human-readable labels ────────────────────────────────────
const RESULT_LABEL: Record<ApprovalResult, string> = {
  approved: "aprovar",
  changes: "pedir ajuste",
  rejected: "reprovar",
};

export function describeTrigger(t: AutomationTrigger): string {
  return t.type === "entered_stage"
    ? `Quando entrar em "${statusConfig(t.stage).label}"`
    : `Quando o cliente ${RESULT_LABEL[t.result]}`;
}

export function describeAction(a: AutomationAction): string {
  switch (a.type) {
    case "move_to_stage":
      return `mover para "${statusConfig(a.stage).label}"`;
    case "send_for_review":
      return "enviar para aprovação do cliente";
    case "set_due_in_days":
      return `reagendar em ${a.days} ${a.days === 1 ? "dia" : "dias"}`;
  }
}

export function describeRule(r: AutomationRule): string {
  return `${describeTrigger(r.trigger)} → ${describeAction(r.action)}`;
}

/**
 * Rules an agency almost always wants, offered as one-click presets so the
 * feature is useful without anyone composing rules by hand.
 */
export function presetRules(calendarId: string): Omit<AutomationRule, "id" | "createdAt">[] {
  return [
    {
      calendarId,
      active: true,
      trigger: { type: "entered_stage", stage: "done" },
      action: { type: "send_for_review" },
    },
    {
      calendarId,
      active: true,
      trigger: { type: "review_decided", result: "approved" },
      action: { type: "move_to_stage", stage: "published" },
    },
    {
      calendarId,
      active: true,
      trigger: { type: "review_decided", result: "changes" },
      action: { type: "move_to_stage", stage: "todo" },
    },
  ];
}

/**
 * Reject a rule that would obviously fight itself, before it is saved.
 * Returns an error message, or null when the rule is sane.
 */
export function validateRule(rule: Omit<AutomationRule, "id" | "createdAt">): string | null {
  const { trigger, action } = rule;
  if (
    trigger.type === "entered_stage" &&
    action.type === "move_to_stage" &&
    trigger.stage === action.stage
  ) {
    return "A regra moveria o post para a mesma etapa que a disparou.";
  }
  if (action.type === "set_due_in_days" && (!Number.isFinite(action.days) || action.days < 0)) {
    return "Informe um número de dias válido.";
  }
  return null;
}

// ── Engine ───────────────────────────────────────────────────

/**
 * Everything the engine needs from the outside world.
 *
 * `apply` performs one action and reports the event it raised, if any, so the
 * engine can follow the chain without knowing anything about posts or storage.
 * Keeping it injected is what makes the engine testable without a backend.
 */
export interface AutomationContext {
  apply: (postId: string, action: AutomationAction) => Promise<AutomationEvent | null>;
  /** Stamped on every run, so a replayed event can be recognised and skipped. */
  eventKey?: string;
  /** Appends to the execution log. Failures here must not break the chain. */
  log?: (run: AutomationRun) => void;
  now?: () => string;
  newId?: () => string;
}

let runSeq = 0;

/**
 * Run every rule that matches the event, then follow whatever events those
 * actions raise, depth-first, until the chain guard stops it.
 *
 * A failing action is recorded and the chain moves on: one broken rule must
 * not strand the post halfway through a stage change the user asked for.
 */
export async function runAutomations(
  event: AutomationEvent,
  rules: AutomationRule[],
  ctx: AutomationContext,
  guard: ChainGuard = newChain(),
): Promise<AutomationRun[]> {
  const eventKey = ctx.eventKey;
  const now = ctx.now ?? (() => new Date().toISOString());
  const newId = ctx.newId ?? (() => `run_${Date.now().toString(36)}_${(runSeq += 1)}`);
  const runs: AutomationRun[] = [];

  const record = (run: AutomationRun) => {
    runs.push(run);
    try {
      ctx.log?.(run);
    } catch {
      // The log is an audit trail, not a precondition. Never fail on it.
    }
  };

  for (const rule of matchRules(event, rules)) {
    const allowed = canFire(rule, guard);
    if (allowed.ok === false) {
      record({
        id: newId(),
        ruleId: rule.id,
        postId: event.postId,
        at: now(),
        result: "skipped",
        detail: allowed.reason,
        eventKey,
      });
      continue;
    }

    // Claim the rule before running it, so an action that loops straight back
    // to this same rule finds it already spent.
    guard.firedRuleIds.add(rule.id);

    let next: AutomationEvent | null = null;
    try {
      next = await ctx.apply(event.postId, rule.action);
      record({
        id: newId(),
        ruleId: rule.id,
        postId: event.postId,
        at: now(),
        result: "applied",
        detail: describeAction(rule.action),
        eventKey,
      });
    } catch (err) {
      record({
        id: newId(),
        ruleId: rule.id,
        postId: event.postId,
        at: now(),
        result: "failed",
        detail: err instanceof Error ? err.message : String(err),
        eventKey,
      });
      continue; // a broken rule does not stop the others
    }

    if (next) {
      const deeper: ChainGuard = {
        depth: guard.depth + 1,
        firedRuleIds: guard.firedRuleIds,
      };
      runs.push(...(await runAutomations(next, rules, ctx, deeper)));
    }
  }

  return runs;
}

// ── Catching up on client decisions ──────────────────────────

/**
 * Review decisions are taken by the client, in the client's browser, over a
 * share link that is deliberately allowed to do nothing but record the
 * decision. So nobody applies the "ao aprovar → Publicado" rule at the moment
 * it is decided: the admin app applies it the next time it loads the calendar.
 *
 * This returns the decisions that have not been acted on yet. The execution log
 * is the ledger — one run carrying the decision's `eventKey` is proof that the
 * decision was already handled, so a reload never fires a rule twice.
 */
export function pendingReviewEvents(
  posts: Pick<Post, "id" | "calendarId" | "approval">[],
  rules: AutomationRule[],
  runs: AutomationRun[],
): { event: AutomationEvent; eventKey: string }[] {
  const handled = new Set(runs.map((r) => r.eventKey).filter(Boolean) as string[]);
  const out: { event: AutomationEvent; eventKey: string }[] = [];

  for (const post of posts) {
    const decision = currentDecision(post.approval);
    // An unverified decision is a half-finished one: the client asked for a
    // code and never confirmed it. Nothing should act on it.
    if (!decision || !decision.verified) continue;

    const eventKey = `decision:${decision.id}`;
    if (handled.has(eventKey)) continue;

    const event: AutomationEvent = {
      kind: "review_decided",
      calendarId: post.calendarId,
      postId: post.id,
      result: decision.result,
    };
    if (matchRules(event, rules).length === 0) continue;

    out.push({ event, eventKey });
  }

  return out;
}
