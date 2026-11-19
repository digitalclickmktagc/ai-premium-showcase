import { describe, expect, it } from "vitest";
import {
  MATERIALISATION_WINDOW_DAYS,
  accountBalance,
  accountHasMovement,
  addMonths,
  buildReversal,
  canEditAmount,
  canTransition,
  dueForMaterialisation,
  forecastMonthEnd,
  overdue,
  pendingProjections,
  projectSeries,
  resultByCash,
  resultByCompetence,
  statement,
  targetProgress,
  totalBalance,
  upcoming,
  validateEntry,
  validateSeries,
  validateTransfer,
} from "./finance";
import type { FinanceAccount, FinanceEntry, FinanceSeries, Transfer } from "./types";

const account = (over: Partial<FinanceAccount> = {}): FinanceAccount => ({
  id: "ac1",
  name: "Banco",
  kind: "banco",
  initialBalance: 100000, // R$ 1.000,00
  initialBalanceDate: "2026-01-01",
  active: true,
  createdAt: "t",
  ...over,
});

const entry = (over: Partial<FinanceEntry> = {}): FinanceEntry => ({
  id: "e1",
  nature: "receita",
  description: "Mensalidade Aurora",
  amount: 150000,
  dueDate: "2026-06-10",
  competence: "2026-06",
  status: "pendente",
  accountId: "ac1",
  origin: "manual",
  createdAt: "t",
  ...over,
});

const series = (over: Partial<FinanceSeries> = {}): FinanceSeries => ({
  id: "s1",
  kind: "recorrente",
  everyMonths: 1,
  dayOfMonth: 10,
  totalAmount: 150000,
  startDate: "2026-01-10",
  nature: "receita",
  description: "Mensalidade",
  createdAt: "t",
  ...over,
});

describe("addMonths", () => {
  it("clamps to the last day instead of spilling into the next month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 3)).toBe("2026-04-30");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29"); // leap year
  });

  it("walks forward normally otherwise", () => {
    expect(addMonths("2026-06-10", 1)).toBe("2026-07-10");
    expect(addMonths("2026-12-10", 1)).toBe("2027-01-10");
    expect(addMonths("2026-06-10", 12)).toBe("2027-06-10");
  });
});

describe("projectSeries", () => {
  it("projects an open-ended recurring series without creating anything", () => {
    const charges = projectSeries(series(), "2026-01-01", "2026-12-31");
    expect(charges).toHaveLength(12);
    expect(charges[0].dueDate).toBe("2026-01-10");
    expect(charges[11].dueDate).toBe("2026-12-10");
    // every one is a projection, not a stored row
    expect(charges.every((c) => c.status === "previsto")).toBe(true);
    expect(charges.every((c) => c.origin === "serie")).toBe(true);
  });

  it("respects the end date", () => {
    const charges = projectSeries(series({ endDate: "2026-03-31" }), "2026-01-01", "2026-12-31");
    expect(charges).toHaveLength(3);
  });

  it("honours the interval between charges", () => {
    const quarterly = projectSeries(
      series({ everyMonths: 3 }),
      "2026-01-01",
      "2026-12-31",
    );
    expect(quarterly.map((c) => c.dueDate)).toEqual([
      "2026-01-10",
      "2026-04-10",
      "2026-07-10",
      "2026-10-10",
    ]);
  });

  it("splits an instalment plan so the parts add back up to the total", () => {
    const parts = projectSeries(
      series({ kind: "parcelada", count: 3, totalAmount: 29999 }),
      "2026-01-01",
      "2027-12-31",
    );
    expect(parts).toHaveLength(3);
    expect(parts.reduce((sum, p) => sum + p.amount, 0)).toBe(29999);
    expect(parts[2].amount).toBe(10001);
    expect(parts.map((p) => p.seriesPosition)).toEqual([1, 2, 3]);
  });

  it("leaves out the months the agency skipped", () => {
    const charges = projectSeries(
      series({ skipped: ["2026-02", "2026-03"] }),
      "2026-01-01",
      "2026-04-30",
    );
    expect(charges.map((c) => c.competence)).toEqual(["2026-01", "2026-04"]);
  });

  it("gives nothing outside the window asked for", () => {
    expect(projectSeries(series(), "2025-01-01", "2025-12-31")).toEqual([]);
  });
});

describe("pendingProjections", () => {
  it("never doubles a month that already exists for real", () => {
    const stored = [entry({ id: "real", seriesId: "s1", competence: "2026-03", status: "liquidado" })];
    const pending = pendingProjections([series()], stored, "2026-01-01", "2026-04-30");
    expect(pending.map((p) => p.competence)).toEqual(["2026-01", "2026-02", "2026-04"]);
  });

  it("leaves the database untouched: twelve months of projection, zero rows", () => {
    const stored: FinanceEntry[] = [];
    const pending = pendingProjections([series()], stored, "2026-01-01", "2026-12-31");
    expect(pending).toHaveLength(12);
    expect(stored).toHaveLength(0); // the spec's acceptance test
  });
});

describe("dueForMaterialisation", () => {
  it("takes only what falls inside the window", () => {
    // From 1 June: 10 June is 9 days out and comes in; 10 July is 39 days
    // out and stays a projection.
    const due = dueForMaterialisation([series({ startDate: "2026-06-10" })], [], "2026-06-01");
    expect(due.map((e) => e.dueDate)).toEqual(["2026-06-10"]);
    expect(due.every((e) => e.status === "pendente")).toBe(true);
    expect(MATERIALISATION_WINDOW_DAYS).toBe(35);
  });

  it("pulls in the next charge as soon as it reaches the window", () => {
    // From 10 June, 10 July is exactly 30 days out: both come in.
    const due = dueForMaterialisation([series({ startDate: "2026-06-10" })], [], "2026-06-10");
    expect(due.map((e) => e.dueDate)).toEqual(["2026-06-10", "2026-07-10"]);
  });

  it("leaves alone a month that already exists for real", () => {
    const stored = [entry({ seriesId: "s1", competence: "2026-06" })];
    const due = dueForMaterialisation([series({ startDate: "2026-06-10" })], stored, "2026-06-01");
    expect(due).toEqual([]);
  });
});

describe("balances", () => {
  const settled = (over: Partial<FinanceEntry> = {}) =>
    entry({ status: "liquidado", settledAt: "2026-06-10", ...over });

  it("counts only settled entries", () => {
    const entries = [settled({ amount: 50000 }), entry({ id: "e2", amount: 999999 })];
    expect(accountBalance(account(), entries, [], "2026-06-30")).toBe(150000);
  });

  it("subtracts expenses and adds revenue", () => {
    const entries = [
      settled({ id: "r", nature: "receita", amount: 50000 }),
      settled({ id: "d", nature: "despesa", amount: 20000 }),
    ];
    expect(accountBalance(account(), entries, [], "2026-06-30")).toBe(100000 + 50000 - 20000);
  });

  it("ignores what settles after the date asked for", () => {
    const entries = [settled({ amount: 50000, settledAt: "2026-07-01" })];
    expect(accountBalance(account(), entries, [], "2026-06-30")).toBe(100000);
  });

  it("moves value between accounts on a transfer, and nothing else", () => {
    const a = account({ id: "ac1" });
    const b = account({ id: "ac2", initialBalance: 0 });
    const t: Transfer[] = [
      { id: "t1", fromAccountId: "ac1", toAccountId: "ac2", amount: 30000, date: "2026-06-05", createdAt: "t" },
    ];
    expect(accountBalance(a, [], t, "2026-06-30")).toBe(70000);
    expect(accountBalance(b, [], t, "2026-06-30")).toBe(30000);
    expect(totalBalance([a, b], [], t, "2026-06-30")).toBe(100000); // unchanged
    // and it never touches the result
    expect(resultByCompetence([], "2026-06").result).toBe(0);
    expect(resultByCash([], "2026-06").result).toBe(0);
  });

  it("is zero before the account existed", () => {
    expect(accountBalance(account(), [], [], "2025-12-31")).toBe(0);
  });

  it("agrees with the statement rebuilt from the movements", () => {
    const entries = [
      settled({ id: "a", amount: 50000, settledAt: "2026-06-02" }),
      settled({ id: "b", nature: "despesa", amount: 20000, settledAt: "2026-06-05" }),
      settled({ id: "c", amount: 10000, settledAt: "2026-06-20" }),
    ];
    const transfers: Transfer[] = [
      { id: "t", fromAccountId: "ac1", toAccountId: "ac2", amount: 5000, date: "2026-06-10", createdAt: "t" },
    ];
    const lines = statement(account(), entries, transfers);
    expect(lines[lines.length - 1].balance).toBe(
      accountBalance(account(), entries, transfers, "2026-06-30"),
    );
    expect(lines.map((l) => l.date)).toEqual([
      "2026-06-02",
      "2026-06-05",
      "2026-06-10",
      "2026-06-20",
    ]);
  });
});

describe("results", () => {
  const entries = [
    entry({ id: "a", nature: "receita", amount: 150000, competence: "2026-06", status: "liquidado", settledAt: "2026-06-15" }),
    entry({ id: "b", nature: "receita", amount: 50000, competence: "2026-06", status: "pendente" }),
    entry({ id: "c", nature: "despesa", amount: 30000, competence: "2026-06", status: "liquidado", settledAt: "2026-07-02" }),
    entry({ id: "d", nature: "despesa", amount: 99999, competence: "2026-06", status: "cancelado" }),
  ];

  it("by competence, expected: everything but the cancelled", () => {
    expect(resultByCompetence(entries, "2026-06")).toEqual({
      revenue: 200000,
      expense: 30000,
      result: 170000,
    });
  });

  it("by competence, realised: settled only", () => {
    expect(resultByCompetence(entries, "2026-06", { onlySettled: true })).toEqual({
      revenue: 150000,
      expense: 30000,
      result: 120000,
    });
  });

  it("by cash: what moved in the month, wherever it was booked", () => {
    // the expense settled in July belongs to July's cash, not June's
    expect(resultByCash(entries, "2026-06")).toEqual({
      revenue: 150000,
      expense: 0,
      result: 150000,
    });
    expect(resultByCash(entries, "2026-07")).toEqual({
      revenue: 0,
      expense: 30000,
      result: -30000,
    });
  });

  it("never counts a cancelled entry", () => {
    expect(resultByCompetence(entries, "2026-06").expense).toBe(30000);
  });
});

describe("forecastMonthEnd", () => {
  it("adds what is still expected before the month closes", () => {
    const entries = [
      entry({ id: "s", status: "liquidado", amount: 50000, settledAt: "2026-06-05" }),
      entry({ id: "in", nature: "receita", amount: 20000, dueDate: "2026-06-25" }),
      entry({ id: "out", nature: "despesa", amount: 15000, dueDate: "2026-06-28" }),
    ];
    // balance on 10 June = 1.000 + 500 = 1.500; plus 200 in, minus 150 out
    expect(forecastMonthEnd([account()], entries, [], "2026-06", "2026-06-10")).toBe(
      150000 + 20000 - 15000,
    );
  });

  it("leaves out what is already overdue — that is not a surprise ahead", () => {
    const entries = [entry({ nature: "receita", amount: 20000, dueDate: "2026-06-01" })];
    expect(forecastMonthEnd([account()], entries, [], "2026-06", "2026-06-10")).toBe(100000);
  });
});

describe("overdue and upcoming", () => {
  it("lists open entries past their date, oldest first", () => {
    const entries = [
      entry({ id: "b", dueDate: "2026-06-05" }),
      entry({ id: "a", dueDate: "2026-06-01" }),
      entry({ id: "paid", dueDate: "2026-06-01", status: "liquidado" }),
    ];
    expect(overdue(entries, "2026-06-10").map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("lists what falls due in the next days", () => {
    const entries = [
      entry({ id: "soon", dueDate: "2026-06-12" }),
      entry({ id: "later", dueDate: "2026-08-01" }),
    ];
    expect(upcoming(entries, 15, "2026-06-10").map((e) => e.id)).toEqual(["soon"]);
  });
});

describe("targetProgress", () => {
  it("measures the month against the target", () => {
    const entries = [
      entry({ categoryId: "c1", nature: "despesa", amount: 30000, competence: "2026-06" }),
      entry({ id: "x", categoryId: "c1", nature: "despesa", amount: 20000, competence: "2026-06" }),
      entry({ id: "y", categoryId: "c1", nature: "despesa", amount: 99999, competence: "2026-07" }),
    ];
    expect(targetProgress(entries, "c1", 100000, "2026-06")).toEqual({
      spent: 50000,
      target: 100000,
      percent: 50,
    });
  });

  it("does not divide by a target of zero", () => {
    expect(targetProgress([], "c1", 0, "2026-06").percent).toBe(0);
  });
});

describe("transitions", () => {
  it("follows the path the spec draws", () => {
    expect(canTransition("previsto", "pendente")).toBe(true);
    expect(canTransition("pendente", "liquidado")).toBe(true);
    expect(canTransition("liquidado", "pendente")).toBe(true); // undo, audited
    expect(canTransition("pendente", "cancelado")).toBe(true);
  });

  it("refuses to jump from a projection straight to settled", () => {
    expect(canTransition("previsto", "liquidado")).toBe(false);
  });

  it("never lets a settled amount be edited", () => {
    expect(canEditAmount(entry({ status: "liquidado" }))).toBe(false);
    expect(canEditAmount(entry({ status: "pendente" }))).toBe(true);
  });

  it("reverses by mirroring, leaving the original alone", () => {
    const original = entry({ status: "liquidado", amount: 150000, settledAt: "2026-06-10" });
    const reversal = buildReversal(original, "rev1", "2026-07-01");
    expect(reversal).toMatchObject({
      nature: "despesa",
      amount: 150000,
      status: "liquidado",
      competence: "2026-07",
      reversalOf: "e1",
    });
    expect(original.status).toBe("liquidado"); // untouched
    // and together they cancel out
    expect(
      resultByCash([original, reversal], "2026-06").result +
        resultByCash([original, reversal], "2026-07").result,
    ).toBe(0);
  });
});

describe("validation", () => {
  it("insists on cents, a description and a date", () => {
    expect(validateEntry({ ...entry(), description: " " })).toBeTruthy();
    expect(validateEntry({ ...entry(), amount: 0 })).toBeTruthy();
    expect(validateEntry({ ...entry(), amount: 10.5 })).toMatch(/centavos/);
    expect(validateEntry({ ...entry(), dueDate: "" })).toBeTruthy();
    expect(validateEntry(entry())).toBeNull();
  });

  it("will not settle an entry with no account", () => {
    expect(
      validateEntry({ ...entry(), status: "liquidado", accountId: undefined }),
    ).toMatch(/conta/);
  });

  it("refuses a transfer to the same account", () => {
    expect(validateTransfer({ fromAccountId: "a", toAccountId: "a", amount: 100 })).toBeTruthy();
    expect(validateTransfer({ fromAccountId: "a", toAccountId: "b", amount: 0 })).toBeTruthy();
    expect(validateTransfer({ fromAccountId: "a", toAccountId: "b", amount: 100 })).toBeNull();
  });

  it("spots an account that has moved", () => {
    expect(accountHasMovement("ac1", [entry()], [])).toBe(true);
    expect(accountHasMovement("ac9", [entry()], [])).toBe(false);
    expect(
      accountHasMovement("ac9", [], [
        { id: "t", fromAccountId: "ac9", toAccountId: "ac1", amount: 1, date: "d", createdAt: "t" },
      ]),
    ).toBe(true);
  });

  it("keeps an instalment plan inside what the spec allows", () => {
    expect(validateSeries(series({ kind: "parcelada", count: 1 }))).toBeTruthy();
    expect(validateSeries(series({ kind: "parcelada", count: 61 }))).toBeTruthy();
    expect(validateSeries(series({ kind: "parcelada", count: 12 }))).toBeNull();
    expect(validateSeries(series({ endDate: "2025-01-01" }))).toMatch(/depois do início/);
  });
});
