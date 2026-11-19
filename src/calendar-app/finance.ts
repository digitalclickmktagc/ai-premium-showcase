import type {
  EntryNature,
  EntryStatus,
  FinanceAccount,
  FinanceEntry,
  FinanceSeries,
  Transfer,
} from "./types";
import { splitInstallments } from "./money";
import { todayISO } from "./utils";

/**
 * Finance core (benchmark spec 08).
 *
 * Two decisions shape everything here.
 *
 * **Cents, always.** Every amount is an integer. The spec says it, and the
 * reason is that a cent lost to floating point does not show up until a
 * reconciliation disagrees months later.
 *
 * **A recurring series does not materialise the future.** Charges are
 * *projected* by query up to whatever horizon is asked for, and only become
 * real rows when they come inside the materialisation window or when someone
 * touches that month. A twelve-month projection of an open-ended series
 * creates nothing in the database — which is the spec's acceptance test and
 * the difference between a forecast and a mess to clean up.
 */

/** Days ahead a recurring charge becomes a real row (decision D16). */
export const MATERIALISATION_WINDOW_DAYS = 35;
/** How far reports project by default. */
export const PROJECTION_MONTHS = 12;

export const STATUS_LABEL: Record<EntryStatus, string> = {
  previsto: "Previsto",
  pendente: "Pendente",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

export const STATUS_COLOR: Record<EntryStatus, string> = {
  previsto: "#94a3b8",
  pendente: "#f59e0b",
  liquidado: "#22c55e",
  cancelado: "#64748b",
};

// ── Dates ────────────────────────────────────────────────────

export function monthOf(dayISO: string): string {
  return dayISO.slice(0, 7);
}

export function addMonths(dayISO: string, months: number): string {
  const [y, m, d] = dayISO.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1 + months, 1));
  // Clamp to the last day of the target month: 31 January + 1 month is
  // 28 February, not 3 March.
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, lastDay));
  return base.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) /
      86_400_000,
  );
}

// ── Series projection ────────────────────────────────────────

/**
 * The charges a series would produce between two dates.
 *
 * These are *virtual*: they exist only in the answer, never in storage. An
 * instalment plan is split so the parts add back up to the total exactly,
 * with the remainder on the last one.
 */
export function projectSeries(
  series: FinanceSeries,
  from: string,
  to: string,
): FinanceEntry[] {
  const out: FinanceEntry[] = [];
  const amounts =
    series.kind === "parcelada" && series.count
      ? splitInstallments(series.totalAmount, series.count)
      : null;
  const limit = series.kind === "parcelada" ? (series.count ?? 0) : Number.MAX_SAFE_INTEGER;
  const skipped = new Set(series.skipped ?? []);

  let dueDate = series.startDate;
  for (let i = 0; i < limit; i += 1) {
    if (dueDate > to) break;
    if (series.endDate && dueDate > series.endDate) break;
    // 2000 charges is already a century of monthly billing; past that the
    // caller asked for something it cannot use.
    if (i > 2000) break;

    const competence = monthOf(dueDate);
    if (dueDate >= from && !skipped.has(competence)) {
      out.push({
        id: `${series.id}:${i + 1}`,
        nature: series.nature,
        description: series.description,
        amount: amounts ? amounts[i] : series.totalAmount,
        dueDate,
        competence,
        status: "previsto",
        accountId: series.accountId,
        categoryId: series.categoryId,
        clientId: series.clientId,
        seriesId: series.id,
        seriesPosition: i + 1,
        origin: "serie",
        createdAt: series.createdAt,
      });
    }
    dueDate = addMonths(dueDate, series.everyMonths);
  }
  return out;
}

/**
 * Projected charges that have no real row yet.
 *
 * A month the agency already touched — edited, settled, attached something to
 * — exists for real, and the projection must not double it.
 */
export function pendingProjections(
  series: FinanceSeries[],
  stored: FinanceEntry[],
  from: string,
  to: string,
): FinanceEntry[] {
  const taken = new Set(
    stored
      .filter((e) => e.seriesId)
      .map((e) => `${e.seriesId}:${e.competence}`),
  );
  return series
    .flatMap((s) => projectSeries(s, from, to))
    .filter((e) => !taken.has(`${e.seriesId}:${e.competence}`));
}

/** Projections close enough to become real rows (the spec's window). */
export function dueForMaterialisation(
  series: FinanceSeries[],
  stored: FinanceEntry[],
  today = todayISO(),
): FinanceEntry[] {
  const horizon = addMonths(today, 2);
  return pendingProjections(series, stored, today, horizon)
    .filter((e) => daysBetween(today, e.dueDate) <= MATERIALISATION_WINDOW_DAYS)
    .map((e) => ({ ...e, status: "pendente" as const }));
}

// ── Balances ─────────────────────────────────────────────────

const signOf = (nature: EntryNature) => (nature === "receita" ? 1 : -1);

/**
 * An account's balance on a date.
 *
 * Only settled entries move a balance: a bill that exists is not money that
 * left. Transfers move value between accounts without touching the result.
 */
export function accountBalance(
  account: FinanceAccount,
  entries: FinanceEntry[],
  transfers: Transfer[],
  onDate = todayISO(),
): number {
  if (onDate < account.initialBalanceDate) return 0;
  let balance = account.initialBalance;

  for (const e of entries) {
    if (e.status !== "liquidado" || e.accountId !== account.id) continue;
    const when = (e.settledAt ?? e.dueDate).slice(0, 10);
    if (when > onDate) continue;
    balance += signOf(e.nature) * e.amount;
  }

  for (const t of transfers) {
    if (t.date > onDate) continue;
    if (t.fromAccountId === account.id) balance -= t.amount;
    if (t.toAccountId === account.id) balance += t.amount;
  }

  return balance;
}

export function totalBalance(
  accounts: FinanceAccount[],
  entries: FinanceEntry[],
  transfers: Transfer[],
  onDate = todayISO(),
): number {
  return accounts.reduce(
    (sum, a) => sum + accountBalance(a, entries, transfers, onDate),
    0,
  );
}

/** One account's statement, with the running balance after each movement. */
export interface StatementLine {
  date: string;
  description: string;
  delta: number;
  balance: number;
}

export function statement(
  account: FinanceAccount,
  entries: FinanceEntry[],
  transfers: Transfer[],
): StatementLine[] {
  const moves: { date: string; description: string; delta: number }[] = [];

  for (const e of entries) {
    if (e.status !== "liquidado" || e.accountId !== account.id) continue;
    moves.push({
      date: (e.settledAt ?? e.dueDate).slice(0, 10),
      description: e.description,
      delta: signOf(e.nature) * e.amount,
    });
  }
  for (const t of transfers) {
    if (t.fromAccountId === account.id)
      moves.push({ date: t.date, description: t.note ?? "Transferência enviada", delta: -t.amount });
    if (t.toAccountId === account.id)
      moves.push({ date: t.date, description: t.note ?? "Transferência recebida", delta: t.amount });
  }

  moves.sort((a, b) => a.date.localeCompare(b.date));
  let running = account.initialBalance;
  return moves.map((m) => {
    running += m.delta;
    return { ...m, balance: running };
  });
}

// ── Results ──────────────────────────────────────────────────

export interface MonthResult {
  revenue: number;
  expense: number;
  result: number;
}

const COUNTS = (e: FinanceEntry) => e.status !== "cancelado";

/**
 * Accrual result: everything whose competence falls in the month, cancelled
 * aside. `onlySettled` gives the realised figure; the default gives the
 * expected one.
 */
export function resultByCompetence(
  entries: FinanceEntry[],
  month: string,
  { onlySettled = false } = {},
): MonthResult {
  let revenue = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.competence !== month || !COUNTS(e)) continue;
    if (onlySettled && e.status !== "liquidado") continue;
    if (e.nature === "receita") revenue += e.amount;
    else expense += e.amount;
  }
  return { revenue, expense, result: revenue - expense };
}

/** Cash result: what actually moved in the month. Transfers never count. */
export function resultByCash(entries: FinanceEntry[], month: string): MonthResult {
  let revenue = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.status !== "liquidado") continue;
    if (monthOf((e.settledAt ?? e.dueDate).slice(0, 10)) !== month) continue;
    if (e.nature === "receita") revenue += e.amount;
    else expense += e.amount;
  }
  return { revenue, expense, result: revenue - expense };
}

/**
 * Where the month ends up: today's balance plus what is still expected to
 * come in and go out before it closes.
 */
export function forecastMonthEnd(
  accounts: FinanceAccount[],
  entries: FinanceEntry[],
  transfers: Transfer[],
  month: string,
  today = todayISO(),
): number {
  let balance = totalBalance(accounts, entries, transfers, today);
  for (const e of entries) {
    if (!COUNTS(e) || e.status === "liquidado") continue;
    if (monthOf(e.dueDate) !== month) continue;
    if (e.dueDate < today) continue; // already overdue: not a surprise ahead
    balance += signOf(e.nature) * e.amount;
  }
  return balance;
}

/** Open entries past their due date. */
export function overdue(entries: FinanceEntry[], today = todayISO()): FinanceEntry[] {
  return entries
    .filter((e) => (e.status === "pendente" || e.status === "previsto") && e.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function upcoming(
  entries: FinanceEntry[],
  days = 15,
  today = todayISO(),
): FinanceEntry[] {
  return entries
    .filter(
      (e) =>
        (e.status === "pendente" || e.status === "previsto") &&
        e.dueDate >= today &&
        daysBetween(today, e.dueDate) <= days,
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** How a category is doing against its monthly target. */
export function targetProgress(
  entries: FinanceEntry[],
  categoryId: string,
  target: number,
  month: string,
): { spent: number; target: number; percent: number } {
  const spent = entries
    .filter((e) => e.categoryId === categoryId && e.competence === month && COUNTS(e))
    .reduce((sum, e) => sum + e.amount, 0);
  return {
    spent,
    target,
    percent: target > 0 ? Math.round((spent / target) * 100) : 0,
  };
}

// ── Transitions ──────────────────────────────────────────────

const ALLOWED: Record<EntryStatus, EntryStatus[]> = {
  previsto: ["pendente", "cancelado"],
  pendente: ["liquidado", "cancelado"],
  // Undoing a settlement is allowed and audited; the value never changes.
  liquidado: ["pendente"],
  cancelado: ["pendente"],
};

export function canTransition(from: EntryStatus, to: EntryStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

/** A settled entry's amount is never edited. Correcting it means reversing. */
export function canEditAmount(entry: FinanceEntry): boolean {
  return entry.status !== "liquidado";
}

/** The mirror entry that undoes a settled one. */
export function buildReversal(entry: FinanceEntry, id: string, on = todayISO()): FinanceEntry {
  return {
    ...entry,
    id,
    description: `Estorno — ${entry.description}`,
    nature: entry.nature === "receita" ? "despesa" : "receita",
    dueDate: on,
    competence: monthOf(on),
    status: "liquidado",
    settledAt: on,
    seriesId: undefined,
    seriesPosition: undefined,
    reversalOf: entry.id,
    origin: "manual",
    createdAt: new Date().toISOString(),
  };
}

// ── Validation ───────────────────────────────────────────────

export function validateEntry(
  e: Pick<FinanceEntry, "description" | "amount" | "dueDate" | "status" | "accountId">,
): string | null {
  if (!e.description.trim()) return "Descreva o lançamento.";
  if (!Number.isInteger(e.amount)) return "O valor precisa estar em centavos inteiros.";
  if (e.amount <= 0) return "O valor precisa ser maior que zero.";
  if (!e.dueDate) return "Informe o vencimento.";
  if (e.status === "liquidado" && !e.accountId)
    return "Para liquidar é preciso dizer em qual conta.";
  return null;
}

export function validateTransfer(t: Pick<Transfer, "fromAccountId" | "toAccountId" | "amount">): string | null {
  if (!t.fromAccountId || !t.toAccountId) return "Escolha as duas contas.";
  if (t.fromAccountId === t.toAccountId) return "Origem e destino precisam ser diferentes.";
  if (t.amount <= 0) return "O valor precisa ser maior que zero.";
  return null;
}

/** An account that has moved is deactivated, never deleted. */
export function accountHasMovement(
  accountId: string,
  entries: FinanceEntry[],
  transfers: Transfer[],
): boolean {
  return (
    entries.some((e) => e.accountId === accountId) ||
    transfers.some((t) => t.fromAccountId === accountId || t.toAccountId === accountId)
  );
}

export function validateSeries(s: FinanceSeries): string | null {
  if (!s.description.trim()) return "Descreva a série.";
  if (s.totalAmount <= 0) return "O valor precisa ser maior que zero.";
  if (s.everyMonths < 1) return "O intervalo precisa ser de ao menos um mês.";
  if (s.kind === "parcelada") {
    if (!s.count || s.count < 2 || s.count > 60)
      return "Um parcelamento vai de 2 a 60 parcelas.";
  }
  if (s.endDate && s.endDate < s.startDate)
    return "O fim precisa ser depois do início.";
  return null;
}
