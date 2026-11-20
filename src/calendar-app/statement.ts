import type { FinanceEntry, StatementLine } from "./types";
import { uid } from "./utils";

/**
 * Conciliação de extrato (benchmark ficha 13, item F13b).
 *
 * Two rules shape everything here, and both come from the ficha:
 *
 *   • The system **suggests**, it never decides. When two entries have the
 *     same value, a person chooses. An automatic match that picks the wrong
 *     invoice is worse than no match, because nobody goes looking for it.
 *   • A confirmed reconciliation settles the entry **on the bank's date**,
 *     not today's. The bank is the fact; the system is the record of it.
 *
 * Undo only reverses what the reconciliation itself did. A line that was
 * linked to an entry someone had already settled by hand is unlinked and
 * that entry is left exactly as it was.
 */

export const LINE_STATUS_LABEL: Record<StatementLine["status"], string> = {
  a_conferir: "A conferir",
  conferida: "Conferida",
  ignorada: "Ignorada",
};

// ── Import ───────────────────────────────────────────────────

export interface ParsedLine {
  date: string;
  description: string;
  /** Integer cents, signed: negative is money leaving the account. */
  amount: number;
  /** The bank's own id for the transaction (OFX FITID), when there is one. */
  externalId?: string;
}

export interface ParseResult {
  lines: ParsedLine[];
  /** One message per line that could not be read, with its line number. */
  errors: string[];
}

function normaliseDate(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const br = value.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const ofx = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;
  return null;
}

/**
 * Money as Brazilian banks write it: `-1.234,56`, `1234.56`, `(1.234,56)`.
 * Returns signed cents, so the sign of the statement is kept as the bank
 * meant it.
 */
export function parseAmount(raw: string): number | null {
  let value = raw.trim().replace(/\s|R\$/g, "");
  if (!value) return null;
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }
  // 1.234,56 (pt-BR) vs 1,234.56 (en): the last separator is the decimal one.
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma > lastDot) value = value.replace(/\./g, "").replace(",", ".");
  else value = value.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

const SEPARATORS = [";", ",", "\t"];

function splitCsvLine(line: string, separator: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === separator && !quoted) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out.map((c) => c.trim());
}

function pickSeparator(sample: string): string {
  return (
    SEPARATORS.map((sep) => ({ sep, count: sample.split(sep).length }))
      .sort((a, b) => b.count - a.count)[0]?.sep ?? ";"
  );
}

/** Reads an OFX file, which is what most Brazilian banks export. */
function parseOfx(text: string): ParseResult {
  const lines: ParsedLine[] = [];
  const errors: string[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  blocks.forEach((block, index) => {
    const field = (tag: string) =>
      block.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"))?.[1]?.trim();
    const date = normaliseDate(field("DTPOSTED") ?? "");
    const amount = parseAmount(field("TRNAMT") ?? "");
    const description = (field("MEMO") || field("NAME") || "").trim();
    if (!date || amount === null) {
      errors.push(`Transação ${index + 1}: data ou valor ilegível.`);
      return;
    }
    lines.push({ date, description, amount, externalId: field("FITID") });
  });
  return { lines, errors };
}

/**
 * Reads a statement. CSV with a header is the common case; OFX is detected
 * by its own markup. Columns are found by name, so column order does not
 * matter — banks never agree on it anyway.
 */
export function parseStatement(text: string): ParseResult {
  if (/<STMTTRN>/i.test(text)) return parseOfx(text);

  const rows = text.split(/\r?\n/).filter((r) => r.trim());
  if (rows.length === 0) return { lines: [], errors: ["Arquivo vazio."] };

  const separator = pickSeparator(rows[0]);
  const header = splitCsvLine(rows[0], separator).map((h) => h.toLowerCase());
  const find = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n)));

  let dateAt = find("data", "date");
  let descAt = find("desc", "histórico", "historico", "memo", "lançamento", "lancamento");
  let amountAt = find("valor", "amount", "montante");
  let creditAt = find("crédito", "credito");
  let debitAt = find("débito", "debito");
  const idAt = find("id", "fitid", "documento");

  const hasHeader = dateAt >= 0 && (amountAt >= 0 || (creditAt >= 0 && debitAt >= 0));
  const body = hasHeader ? rows.slice(1) : rows;
  if (!hasHeader) {
    // No header: fall back to the order every bank uses when it omits one.
    dateAt = 0;
    descAt = 1;
    amountAt = 2;
    creditAt = -1;
    debitAt = -1;
  }

  const lines: ParsedLine[] = [];
  const errors: string[] = [];
  body.forEach((row, index) => {
    const cells = splitCsvLine(row, separator);
    const date = normaliseDate(cells[dateAt] ?? "");
    let amount = amountAt >= 0 ? parseAmount(cells[amountAt] ?? "") : null;
    if (amount === null && creditAt >= 0 && debitAt >= 0) {
      const credit = parseAmount(cells[creditAt] ?? "") ?? 0;
      const debit = parseAmount(cells[debitAt] ?? "") ?? 0;
      amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
    }
    if (!date || amount === null || amount === 0) {
      errors.push(`Linha ${index + (hasHeader ? 2 : 1)}: data ou valor ilegível.`);
      return;
    }
    lines.push({
      date,
      description: (cells[descAt] ?? "").trim(),
      amount,
      externalId: idAt >= 0 ? cells[idAt]?.trim() || undefined : undefined,
    });
  });
  return { lines, errors };
}

/** What identifies a transaction when the bank gives no id of its own. */
export function lineKey(accountId: string, line: ParsedLine): string {
  return (
    line.externalId?.trim() ||
    `${accountId}|${line.date}|${line.amount}|${line.description.trim().toLowerCase()}`
  );
}

export interface ImportResult {
  /** Lines that are new and will be saved. */
  fresh: StatementLine[];
  /** How many lines the account already had. */
  duplicates: number;
  errors: string[];
}

/**
 * Turns a parsed file into lines to store, dropping what is already there.
 * Importing the same file twice is something everyone does; doing it must
 * be boring, not destructive.
 */
export function buildImport(
  accountId: string,
  parsed: ParseResult,
  existing: StatementLine[],
  now = new Date().toISOString(),
  newId: () => string = () => uid("ext"),
): ImportResult {
  const seen = new Set(existing.filter((l) => l.accountId === accountId).map((l) => l.key));
  const fresh: StatementLine[] = [];
  let duplicates = 0;
  for (const line of parsed.lines) {
    const key = lineKey(accountId, line);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    fresh.push({
      id: newId(),
      accountId,
      key,
      date: line.date,
      description: line.description,
      amount: line.amount,
      status: "a_conferir",
      createdAt: now,
    });
  }
  return { fresh, duplicates, errors: parsed.errors };
}

// ── Matching ─────────────────────────────────────────────────

export interface Suggestion {
  entry: FinanceEntry;
  /** 0–100. Above 90 means same value and same day. */
  confidence: number;
  reason: string;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000,
  );
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
}

/** How much two descriptions have in common, 0–1. */
export function textAffinity(a: string, b: string): number {
  const left = words(a);
  const right = new Set(words(b));
  if (left.length === 0 || right.size === 0) return 0;
  const hits = left.filter((w) => right.has(w)).length;
  return hits / left.length;
}

/**
 * Candidate entries for one statement line, best first.
 *
 * Only entries of the same value and the same direction are considered: the
 * bank's sign says whether money came in or left, and an expense never
 * reconciles against a receipt.
 */
export function suggestMatches(
  line: StatementLine,
  entries: FinanceEntry[],
  maxDays = 5,
): Suggestion[] {
  const nature = line.amount < 0 ? "despesa" : "receita";
  const value = Math.abs(line.amount);
  return entries
    .filter(
      (e) =>
        e.nature === nature &&
        e.amount === value &&
        e.status !== "cancelado" &&
        !e.reversalOf &&
        // An entry already matched to another line is out of the running.
        true,
    )
    .map((entry) => {
      const distance = daysBetween(entry.dueDate, line.date);
      const affinity = textAffinity(line.description, entry.description);
      let confidence: number;
      let reason: string;
      if (distance === 0) {
        confidence = 92;
        reason = "mesmo valor, mesmo dia";
      } else if (distance <= maxDays) {
        confidence = 75 - distance * 3;
        reason = `mesmo valor, ${distance} dia(s) de diferença`;
      } else {
        confidence = 40;
        reason = "mesmo valor, data distante";
      }
      confidence = Math.min(99, Math.round(confidence + affinity * 8));
      if (affinity > 0) reason += ", descrição parecida";
      return { entry, confidence, reason };
    })
    .sort((a, b) => b.confidence - a.confidence || a.entry.dueDate.localeCompare(b.entry.dueDate));
}

/**
 * The one suggestion safe to apply without asking. The ficha is explicit:
 * when more than one entry has the same value, a person chooses.
 */
export function autoMatch(suggestions: Suggestion[], floor = 90): Suggestion | null {
  const strong = suggestions.filter((s) => s.confidence >= floor);
  return strong.length === 1 ? strong[0] : null;
}

// ── Effects ──────────────────────────────────────────────────

export interface Reconciliation {
  line: StatementLine;
  entry: FinanceEntry;
}

/**
 * Confirms a match: the line is checked off and the entry is settled on the
 * bank's date, in the account the statement belongs to.
 */
export function reconcile(
  line: StatementLine,
  entry: FinanceEntry,
  now = new Date().toISOString(),
): Reconciliation {
  const alreadySettled = entry.status === "liquidado";
  return {
    line: {
      ...line,
      status: "conferida",
      entryId: entry.id,
      // Remembering whether we were the ones who settled it is what makes
      // undo safe: a reconciliation never reverses a human's settlement.
      settledEntry: !alreadySettled,
      reconciledAt: now,
    },
    entry: alreadySettled
      ? entry
      : {
          ...entry,
          status: "liquidado",
          settledAt: line.date,
          accountId: entry.accountId ?? line.accountId,
        },
  };
}

/** Undo: unlink, and reverse the settlement only if we caused it. */
export function undoReconcile(line: StatementLine, entry?: FinanceEntry): Reconciliation | { line: StatementLine; entry?: undefined } {
  const clean: StatementLine = {
    ...line,
    status: "a_conferir",
    entryId: undefined,
    settledEntry: undefined,
    reconciledAt: undefined,
  };
  if (!entry || !line.settledEntry || entry.id !== line.entryId) return { line: clean };
  return {
    line: clean,
    entry: { ...entry, status: "pendente", settledAt: undefined },
  };
}

/** A line nobody will ever match — a bank fee the agency does not track. */
export function ignoreLine(line: StatementLine): StatementLine {
  return { ...line, status: "ignorada", entryId: undefined, settledEntry: undefined };
}

export function unignoreLine(line: StatementLine): StatementLine {
  return { ...line, status: "a_conferir" };
}

/**
 * An entry created straight from the statement: it already happened, so it
 * is born settled, on the bank's date and in the bank's account.
 */
export function entryFromLine(
  line: StatementLine,
  extra: { categoryId?: string; clientId?: string; projectId?: string } = {},
  now = new Date().toISOString(),
  id: string = uid("fin"),
): FinanceEntry {
  const value = Math.abs(line.amount);
  return {
    id,
    nature: line.amount < 0 ? "despesa" : "receita",
    description: line.description.trim() || "Lançamento do extrato",
    amount: value,
    dueDate: line.date,
    competence: line.date.slice(0, 7),
    status: "liquidado",
    settledAt: line.date,
    accountId: line.accountId,
    categoryId: extra.categoryId,
    clientId: extra.clientId,
    projectId: extra.projectId,
    origin: "extrato",
    createdAt: now,
  };
}

export interface StatementSummary {
  total: number;
  pending: number;
  reconciled: number;
  ignored: number;
  /** Sum of the lines still to check, in signed cents. */
  pendingAmount: number;
}

export function summarise(lines: StatementLine[]): StatementSummary {
  const pending = lines.filter((l) => l.status === "a_conferir");
  return {
    total: lines.length,
    pending: pending.length,
    reconciled: lines.filter((l) => l.status === "conferida").length,
    ignored: lines.filter((l) => l.status === "ignorada").length,
    pendingAmount: pending.reduce((sum, l) => sum + l.amount, 0),
  };
}
