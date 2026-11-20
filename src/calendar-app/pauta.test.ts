import { describe, expect, it } from "vitest";
import {
  MAX_WEEKS,
  balanceByFunnel,
  balanceByPillar,
  canEditPlan,
  convertible,
  emptyFunnel,
  expandWeekly,
  forgetCard,
  markConverted,
  monthItems,
  planFor,
  previousMonth,
  seriesToRemove,
  startPlan,
  sumShares,
  toPostInput,
  validatePlan,
  validatePlanItem,
} from "./pauta";
import type { MonthlyPlan, PautaItem } from "./types";

const NOW = "2026-04-01T10:00:00.000Z";

function plan(over: Partial<MonthlyPlan> = {}): MonthlyPlan {
  return {
    id: "pl1",
    clientId: "c1",
    month: "2026-04",
    goals: [],
    objectives: [],
    improvements: [],
    pillars: [],
    funnel: emptyFunnel(),
    actions: [],
    status: "rascunho",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function item(over: Partial<PautaItem> = {}): PautaItem {
  return {
    id: "i1",
    clientId: "c1",
    date: "2026-04-06",
    kind: "post",
    title: "Bastidores da torra",
    channels: ["instagram"],
    status: "ideia",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe("validatePlan", () => {
  it("accepts an empty draft", () => {
    expect(validatePlan(plan())).toBeNull();
  });

  it("demands that the pillars add up to 100", () => {
    const p = plan({ pillars: [{ id: "a", name: "Educar", share: 60 }] });
    expect(validatePlan(p)).toMatch(/somar 100%.*somam 60%/);
  });

  it("accepts pillars that do add up", () => {
    const p = plan({
      pillars: [
        { id: "a", name: "Educar", share: 60 },
        { id: "b", name: "Vender", share: 40 },
      ],
    });
    expect(validatePlan(p)).toBeNull();
  });

  it("refuses a pillar with no name or an impossible share", () => {
    expect(validatePlan(plan({ pillars: [{ id: "a", name: " ", share: 100 }] }))).toMatch(/nome/);
    expect(validatePlan(plan({ pillars: [{ id: "a", name: "X", share: 140 }] }))).toMatch(/0 a 100/);
  });

  it("lets the funnel be untouched, but not half filled", () => {
    expect(validatePlan(plan())).toBeNull();
    const half = plan({ funnel: { ...emptyFunnel(), descoberta: 40 } });
    expect(validatePlan(half)).toMatch(/somar 100%/);
    const full = plan({
      funnel: { descoberta: 40, interesse: 30, conversao: 20, fidelizacao: 10 },
    });
    expect(validatePlan(full)).toBeNull();
  });

  it("refuses a malformed month", () => {
    expect(validatePlan(plan({ month: "abril" }))).toMatch(/Mês inválido/);
  });
});

describe("plan lifecycle", () => {
  it("freezes a validated plan until it is reopened", () => {
    expect(canEditPlan(plan())).toBe(true);
    expect(canEditPlan(plan({ status: "validado" }))).toBe(false);
  });

  it("starts a month carrying the pillars and last month's targets", () => {
    const march = plan({
      month: "2026-03",
      pillars: [{ id: "a", name: "Educar", share: 100 }],
      goals: [{ id: "g1", name: "Seguidores", target: "5.000" }],
      funnel: { descoberta: 70, interesse: 10, conversao: 10, fidelizacao: 10 },
    });
    const april = startPlan("c1", "2026-04", march, NOW, "pl2");
    expect(april.pillars).toEqual([{ id: "a", name: "Educar", share: 100 }]);
    expect(april.funnel.descoberta).toBe(70);
    expect(april.goals).toEqual([{ id: "g1", name: "Seguidores", target: "", previous: "5.000" }]);
    expect(april.status).toBe("rascunho");
  });

  it("does not share the previous month's pillar objects", () => {
    const march = plan({ pillars: [{ id: "a", name: "Educar", share: 100 }] });
    const april = startPlan("c1", "2026-04", march, NOW, "pl2");
    april.pillars[0].name = "Outro";
    expect(march.pillars[0].name).toBe("Educar");
  });

  it("finds a plan by client and month", () => {
    const plans = [plan({ id: "a" }), plan({ id: "b", month: "2026-05" })];
    expect(planFor(plans, "c1", "2026-05")?.id).toBe("b");
    expect(planFor(plans, "c2", "2026-04")).toBeUndefined();
  });

  it("walks back across the turn of the year", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(previousMonth("2026-11")).toBe("2026-10");
  });
});

describe("items", () => {
  it("refuses an item with no title, date or client", () => {
    expect(validatePlanItem(item({ title: "  " }))).toMatch(/título/);
    expect(validatePlanItem(item({ date: "06/04" }))).toMatch(/Data/);
    expect(validatePlanItem(item({ clientId: "" }))).toMatch(/cliente/);
    expect(validatePlanItem(item())).toBeNull();
  });

  it("lists one client's month in date order", () => {
    const items = [
      item({ id: "b", date: "2026-04-20" }),
      item({ id: "a", date: "2026-04-02" }),
      item({ id: "other", clientId: "c2", date: "2026-04-03" }),
      item({ id: "may", date: "2026-05-01" }),
    ];
    expect(monthItems(items, "c1", "2026-04").map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("expandWeekly", () => {
  const ids = () => {
    let n = 0;
    return () => `gen${(n += 1)}`;
  };

  it("repeats every seven days and shares one series", () => {
    const out = expandWeekly(item(), 3, NOW, ids());
    expect(out.map((i) => i.date)).toEqual(["2026-04-06", "2026-04-13", "2026-04-20"]);
    expect(new Set(out.map((i) => i.seriesId)).size).toBe(1);
    expect(out[0].id).toBe("i1");
  });

  it("keeps the ceiling at twelve weeks", () => {
    expect(expandWeekly(item(), 99, NOW, ids())).toHaveLength(MAX_WEEKS);
    expect(expandWeekly(item(), 0, NOW, ids())).toHaveLength(1);
  });

  it("gives the repeats no card and no decision", () => {
    const converted = item({ status: "convertida", postId: "p1", calendarId: "cal1" });
    const out = expandWeekly(converted, 2, NOW, ids());
    expect(out[1].postId).toBeUndefined();
    expect(out[1].status).toBe("ideia");
    // the original keeps its own card
    expect(out[0].postId).toBe("p1");
  });

  it("crosses the end of the month correctly", () => {
    const out = expandWeekly(item({ date: "2026-04-27" }), 2, NOW, ids());
    expect(out[1].date).toBe("2026-05-04");
  });
});

describe("seriesToRemove", () => {
  const series = [
    item({ id: "a", date: "2026-04-06", seriesId: "s1" }),
    item({ id: "b", date: "2026-04-13", seriesId: "s1" }),
    item({ id: "c", date: "2026-04-20", seriesId: "s1", postId: "p1" }),
    item({ id: "d", date: "2026-04-27", seriesId: "s1" }),
  ];

  it("removes only the one asked for", () => {
    expect(seriesToRemove(series, series[1], "uma").map((i) => i.id)).toEqual(["b"]);
  });

  it("removes this one and the next ones", () => {
    expect(seriesToRemove(series, series[1], "proximas").map((i) => i.id)).toEqual(["b", "d"]);
  });

  it("never removes an item that already became a card", () => {
    expect(seriesToRemove(series, series[2], "uma")).toEqual([]);
    expect(seriesToRemove(series, series[0], "proximas").map((i) => i.id)).toEqual(["a", "b", "d"]);
  });
});

describe("converting to cards", () => {
  it("offers only what has no card yet", () => {
    const items = [item({ id: "a" }), item({ id: "b", postId: "p1" })];
    expect(convertible(items).map((i) => i.id)).toEqual(["a"]);
  });

  it("carries the caption and the briefing into the card", () => {
    const input = toPostInput(
      item({ caption: "Legenda pronta", briefing: "Gravar na torra às 7h", owner: "Bruno" }),
      "cal1",
    );
    expect(input).toMatchObject({
      calendarId: "cal1",
      title: "Bastidores da torra",
      date: "2026-04-06",
      description: "Legenda pronta\n\nGravar na torra às 7h",
      internalNotes: "Responsável: Bruno",
    });
  });

  it("types a story as a story when no format was chosen", () => {
    expect(toPostInput(item({ kind: "story" }), "cal1").contentType).toBe("story");
    expect(toPostInput(item({ kind: "story", format: "reels" }), "cal1").contentType).toBe("reels");
    expect(toPostInput(item(), "cal1").contentType).toBeUndefined();
  });

  it("records the card on the item", () => {
    const out = markConverted(item(), { id: "p1", calendarId: "cal1" }, NOW);
    expect(out).toMatchObject({ status: "convertida", postId: "p1", calendarId: "cal1" });
  });

  it("goes back to being a plan when the card is deleted", () => {
    const converted = markConverted(item(), { id: "p1", calendarId: "cal1" }, NOW);
    const back = forgetCard(converted, "p1", NOW);
    expect(back).toMatchObject({ status: "pronta", postId: undefined, calendarId: undefined });
    expect(forgetCard(converted, "outro")).toBe(converted);
  });
});

describe("panorama de equilíbrio", () => {
  const p = plan({
    pillars: [
      { id: "edu", name: "Educar", share: 50 },
      { id: "ven", name: "Vender", share: 50 },
    ],
    funnel: { descoberta: 50, interesse: 25, conversao: 25, fidelizacao: 0 },
  });

  it("compares what was planned with what is on the pauta", () => {
    const items = [
      item({ id: "1", pillarId: "edu", funnel: "descoberta" }),
      item({ id: "2", pillarId: "edu", funnel: "descoberta" }),
      item({ id: "3", pillarId: "edu", funnel: "interesse" }),
      item({ id: "4", pillarId: "ven", funnel: "conversao" }),
    ];
    const rows = balanceByPillar(p, items);
    expect(rows.map((r) => [r.label, r.planned, r.actual, r.gap])).toEqual([
      ["Educar", 50, 75, 25],
      ["Vender", 50, 25, -25],
    ]);
    const funnel = balanceByFunnel(p, items);
    expect(funnel.find((r) => r.id === "descoberta")).toMatchObject({ actual: 50, gap: 0 });
    expect(funnel.find((r) => r.id === "fidelizacao")).toMatchObject({ actual: 0, count: 0 });
  });

  it("reports what has no pillar instead of hiding it", () => {
    const items = [item({ id: "1", pillarId: "edu" }), item({ id: "2" })];
    const rows = balanceByPillar(p, items);
    expect(rows.at(-1)).toMatchObject({ label: "Sem pilar", count: 1, actual: 50 });
  });

  it("counts an item whose pillar was deleted as having none", () => {
    const rows = balanceByPillar(p, [item({ id: "1", pillarId: "sumiu" })]);
    expect(rows.at(-1)).toMatchObject({ label: "Sem pilar", count: 1 });
  });

  it("shows zeroes, not a crash, for an empty month", () => {
    const rows = balanceByPillar(p, []);
    expect(rows.every((r) => r.actual === 0 && r.count === 0)).toBe(true);
    expect(sumShares(p.pillars)).toBe(100);
  });
});
