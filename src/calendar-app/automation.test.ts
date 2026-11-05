import { describe, expect, it, vi } from "vitest";
import {
  MAX_CHAIN_DEPTH,
  canFire,
  describeRule,
  matchRules,
  newChain,
  pendingReviewEvents,
  presetRules,
  runAutomations,
  validateRule,
  type AutomationAction,
  type AutomationEvent,
  type AutomationRule,
  type AutomationRun,
} from "./automation";
import type { Post, PostStatus } from "./types";

const rule = (over: Partial<AutomationRule> = {}): AutomationRule => ({
  id: "r1",
  calendarId: "cal1",
  trigger: { type: "entered_stage", stage: "done" },
  action: { type: "send_for_review" },
  active: true,
  createdAt: "2026-11-05T10:00:00.000Z",
  ...over,
});

const entered = (stage: PostStatus): AutomationEvent => ({
  kind: "entered_stage",
  calendarId: "cal1",
  postId: "p1",
  stage,
});

describe("matchRules", () => {
  it("matches a stage trigger on the same calendar", () => {
    expect(matchRules(entered("done"), [rule()])).toHaveLength(1);
  });

  it("ignores rules from another calendar", () => {
    expect(matchRules(entered("done"), [rule({ calendarId: "cal2" })])).toEqual([]);
  });

  it("ignores inactive rules", () => {
    expect(matchRules(entered("done"), [rule({ active: false })])).toEqual([]);
  });

  it("ignores a rule whose stage is not the one entered", () => {
    expect(matchRules(entered("todo"), [rule()])).toEqual([]);
  });

  it("matches review decisions by result only", () => {
    const approved = rule({
      id: "r2",
      trigger: { type: "review_decided", result: "approved" },
      action: { type: "move_to_stage", stage: "published" },
    });
    const changes = rule({
      id: "r3",
      trigger: { type: "review_decided", result: "changes" },
      action: { type: "move_to_stage", stage: "todo" },
    });
    const event: AutomationEvent = {
      kind: "review_decided",
      calendarId: "cal1",
      postId: "p1",
      result: "approved",
    };
    expect(matchRules(event, [approved, changes]).map((r) => r.id)).toEqual(["r2"]);
  });

  it("keeps creation order so two rules on one stage are predictable", () => {
    const first = rule({ id: "a" });
    const second = rule({ id: "b", action: { type: "set_due_in_days", days: 3 } });
    expect(matchRules(entered("done"), [first, second]).map((r) => r.id)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("chain guard", () => {
  it("allows a fresh rule on a fresh chain", () => {
    expect(canFire(rule(), newChain())).toEqual({ ok: true });
  });

  it("refuses a rule that already fired in this chain", () => {
    const guard = newChain();
    guard.firedRuleIds.add("r1");
    expect(canFire(rule(), guard).ok).toBe(false);
  });

  it("refuses anything once the depth limit is reached", () => {
    const guard = { depth: MAX_CHAIN_DEPTH, firedRuleIds: new Set<string>() };
    const res = canFire(rule(), guard);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toContain(String(MAX_CHAIN_DEPTH));
  });
});

describe("runAutomations", () => {
  it("applies a matching rule once and logs it as applied", async () => {
    const apply = vi.fn().mockResolvedValue(null);
    const log = vi.fn();
    const runs = await runAutomations(entered("done"), [rule()], { apply, log });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("p1", { type: "send_for_review" });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ ruleId: "r1", postId: "p1", result: "applied" });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no rule matches", async () => {
    const apply = vi.fn();
    expect(await runAutomations(entered("todo"), [rule()], { apply })).toEqual([]);
    expect(apply).not.toHaveBeenCalled();
  });

  it("follows the chain when an action raises a new event", async () => {
    const moveToPublished = rule({
      id: "approved→published",
      trigger: { type: "review_decided", result: "approved" },
      action: { type: "move_to_stage", stage: "published" },
    });
    const onPublished = rule({
      id: "published→reschedule",
      trigger: { type: "entered_stage", stage: "published" },
      action: { type: "set_due_in_days", days: 7 },
    });

    // The post reaching "published" raises the event the second rule listens to.
    const apply = vi.fn(async (_postId: string, action: AutomationAction) =>
      action.type === "move_to_stage"
        ? ({
            kind: "entered_stage",
            calendarId: "cal1",
            postId: "p1",
            stage: action.stage,
          } as AutomationEvent)
        : null,
    );

    const runs = await runAutomations(
      { kind: "review_decided", calendarId: "cal1", postId: "p1", result: "approved" },
      [moveToPublished, onPublished],
      { apply },
    );

    expect(runs.map((r) => r.ruleId)).toEqual(["approved→published", "published→reschedule"]);
    expect(runs.every((r) => r.result === "applied")).toBe(true);
  });

  it("stops two rules that point at each other instead of looping forever", async () => {
    const aToB = rule({
      id: "a",
      trigger: { type: "entered_stage", stage: "done" },
      action: { type: "move_to_stage", stage: "todo" },
    });
    const bToA = rule({
      id: "b",
      trigger: { type: "entered_stage", stage: "todo" },
      action: { type: "move_to_stage", stage: "done" },
    });

    const apply = vi.fn(async (_postId: string, action: AutomationAction) =>
      action.type === "move_to_stage"
        ? ({
            kind: "entered_stage",
            calendarId: "cal1",
            postId: "p1",
            stage: action.stage,
          } as AutomationEvent)
        : null,
    );

    const runs = await runAutomations(entered("done"), [aToB, bToA], { apply });

    // Each rule fires exactly once, then the chain finds them both spent.
    expect(runs.filter((r) => r.result === "applied").map((r) => r.ruleId)).toEqual([
      "a",
      "b",
    ]);
    const skipped = runs.filter((r) => r.result === "skipped");
    expect(skipped).toHaveLength(1);
    expect(skipped[0].detail).toContain("já aplicada");
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("never exceeds the depth limit, even with a self-renewing chain", async () => {
    // A long line of rules, each one moving the post into the next stage, so
    // nothing repeats a rule id — only the depth cap can end this chain.
    const stages = ["done", "todo", "published", "rescheduled"] as const;
    const rules: AutomationRule[] = stages.map((stage, i) => ({
      ...rule({ id: `r${i}` }),
      trigger: { type: "entered_stage", stage },
      action: { type: "move_to_stage", stage: stages[(i + 1) % stages.length] },
    }));

    const apply = vi.fn(async (_postId: string, action: AutomationAction) =>
      action.type === "move_to_stage"
        ? ({
            kind: "entered_stage",
            calendarId: "cal1",
            postId: "p1",
            stage: action.stage,
          } as AutomationEvent)
        : null,
    );

    const runs = await runAutomations(entered("done"), rules, { apply });
    expect(runs.filter((r) => r.result === "applied").length).toBeLessThanOrEqual(
      MAX_CHAIN_DEPTH,
    );
    expect(runs.some((r) => r.result === "skipped")).toBe(true);
  });

  it("records a failing action and still runs the other rules", async () => {
    const broken = rule({ id: "broken" });
    const fine = rule({ id: "fine", action: { type: "set_due_in_days", days: 2 } });

    const apply = vi.fn(async (_postId: string, action: AutomationAction) => {
      if (action.type === "send_for_review") throw new Error("E-mail do cliente ausente.");
      return null;
    });

    const runs = await runAutomations(entered("done"), [broken, fine], { apply });

    expect(runs[0]).toMatchObject({
      ruleId: "broken",
      result: "failed",
      detail: "E-mail do cliente ausente.",
    });
    expect(runs[1]).toMatchObject({ ruleId: "fine", result: "applied" });
  });

  it("survives a log that throws — the audit trail is not a precondition", async () => {
    const apply = vi.fn().mockResolvedValue(null);
    const log = vi.fn(() => {
      throw new Error("storage cheio");
    });
    const runs = await runAutomations(entered("done"), [rule()], { apply, log });
    expect(runs).toHaveLength(1);
    expect(runs[0].result).toBe("applied");
  });
});

describe("validateRule", () => {
  it("rejects a rule that moves the post to the stage that triggered it", () => {
    expect(
      validateRule({
        calendarId: "cal1",
        active: true,
        trigger: { type: "entered_stage", stage: "done" },
        action: { type: "move_to_stage", stage: "done" },
      }),
    ).toMatch(/mesma etapa/);
  });

  it("rejects a non-numeric or negative deadline", () => {
    const base = {
      calendarId: "cal1",
      active: true,
      trigger: { type: "entered_stage", stage: "done" },
    } as const;
    expect(
      validateRule({ ...base, action: { type: "set_due_in_days", days: Number.NaN } }),
    ).toBeTruthy();
    expect(
      validateRule({ ...base, action: { type: "set_due_in_days", days: -1 } }),
    ).toBeTruthy();
    expect(
      validateRule({ ...base, action: { type: "set_due_in_days", days: 0 } }),
    ).toBeNull();
  });

  it("accepts every preset we ship", () => {
    for (const preset of presetRules("cal1")) {
      expect(validateRule(preset)).toBeNull();
    }
  });
});

describe("describeRule", () => {
  it("reads as a sentence in pt-BR", () => {
    expect(describeRule(rule())).toBe(
      'Quando entrar em "Feito" → enviar para aprovação do cliente',
    );
  });

  it("pluralises the deadline", () => {
    expect(describeRule(rule({ action: { type: "set_due_in_days", days: 1 } }))).toContain(
      "1 dia",
    );
    expect(describeRule(rule({ action: { type: "set_due_in_days", days: 3 } }))).toContain(
      "3 dias",
    );
  });
});

describe("pendingReviewEvents — catching up on client decisions", () => {
  const approved = rule({
    id: "approved→published",
    trigger: { type: "review_decided", result: "approved" },
    action: { type: "move_to_stage", stage: "published" },
  });

  const post = (over: Partial<Post> = {}): Pick<Post, "id" | "calendarId" | "approval"> => ({
    id: "p1",
    calendarId: "cal1",
    approval: {
      round: 1,
      decisions: [
        {
          id: "d1",
          round: 1,
          result: "approved",
          verified: true,
          at: "2026-11-05T10:00:00.000Z",
        },
      ],
    },
    ...over,
  });

  const run = (over: Partial<AutomationRun> = {}): AutomationRun => ({
    id: "run1",
    ruleId: "approved→published",
    postId: "p1",
    at: "2026-11-05T10:01:00.000Z",
    result: "applied",
    ...over,
  });

  it("reports a decision nothing has acted on yet", () => {
    const pending = pendingReviewEvents([post()], [approved], []);
    expect(pending).toHaveLength(1);
    expect(pending[0].eventKey).toBe("decision:d1");
    expect(pending[0].event).toMatchObject({ kind: "review_decided", result: "approved" });
  });

  it("does not report a decision already in the log", () => {
    expect(
      pendingReviewEvents([post()], [approved], [run({ eventKey: "decision:d1" })]),
    ).toEqual([]);
  });

  it("does not retry a decision whose rule failed — the failure is in the log", () => {
    expect(
      pendingReviewEvents(
        [post()],
        [approved],
        [run({ eventKey: "decision:d1", result: "failed", detail: "boom" })],
      ),
    ).toEqual([]);
  });

  it("ignores a decision the client never confirmed by e-mail", () => {
    const unverified = post({
      approval: {
        round: 1,
        decisions: [
          {
            id: "d9",
            round: 1,
            result: "approved",
            verified: false,
            at: "2026-11-05T10:00:00.000Z",
          },
        ],
      },
    });
    expect(pendingReviewEvents([unverified], [approved], [])).toEqual([]);
  });

  it("ignores posts never sent for review, and posts still awaiting a decision", () => {
    const never = post({ id: "p2", approval: undefined });
    const waiting = post({ id: "p3", approval: { round: 1, decisions: [] } });
    expect(pendingReviewEvents([never, waiting], [approved], [])).toEqual([]);
  });

  it("only reports decisions some rule actually listens to", () => {
    const onlyChanges = rule({
      id: "changes→todo",
      trigger: { type: "review_decided", result: "changes" },
      action: { type: "move_to_stage", stage: "todo" },
    });
    expect(pendingReviewEvents([post()], [onlyChanges], [])).toEqual([]);
  });

  it("follows the newest decision of the round when the client changes their mind", () => {
    const changedMind = post({
      approval: {
        round: 1,
        decisions: [
          {
            id: "d1",
            round: 1,
            result: "changes",
            comment: "trocar a foto",
            verified: true,
            at: "2026-11-05T10:00:00.000Z",
          },
          {
            id: "d2",
            round: 1,
            result: "approved",
            verified: true,
            at: "2026-11-05T11:00:00.000Z",
          },
        ],
      },
    });
    const pending = pendingReviewEvents([changedMind], [approved], []);
    expect(pending).toHaveLength(1);
    expect(pending[0].eventKey).toBe("decision:d2");
  });
});
