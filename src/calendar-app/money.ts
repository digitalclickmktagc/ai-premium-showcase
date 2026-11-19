/**
 * Money, in integer cents.
 *
 * Spec 08 is explicit: "valores em centavos inteiros; nenhum cálculo em ponto
 * flutuante". Every module that touches money uses this one — a proposal's
 * total, a contract's value and a finance entry have to agree to the cent, and
 * they cannot if each rounds its own way.
 */

export type Cents = number;

/** Read what a person typed: "1.234,56", "1234.56", "R$ 1.234", "1234". */
export function parseMoney(raw: string): Cents | null {
  const text = raw.trim().replace(/^R\$\s*/i, "");
  if (!text) return null;
  if (!/^-?[\d.,]+$/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized: string;

  if (lastComma > lastDot) {
    // pt-BR: dots group thousands, comma is the decimal point.
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = text.replace(/,/g, "");
  } else {
    normalized = text.replace(/[.,]/g, "");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** "R$ 1.234,56" */
export function formatMoney(cents: Cents, withSymbol = true): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const text = (abs / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? "-" : ""}${withSymbol ? "R$ " : ""}${text}`;
}

/** Short form for dense tables: "R$ 1,2 mil", "R$ 3,4 mi". */
export function formatMoneyShort(cents: Cents): string {
  const abs = Math.abs(cents);
  if (abs >= 100_000_000) return `R$ ${(cents / 100_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 100_000) return `R$ ${(cents / 100_000).toFixed(1).replace(".", ",")} mil`;
  return formatMoney(cents);
}

/**
 * Split an amount into n parts that add back up to exactly the amount.
 *
 * The remainder goes on the last part, which is what the spec asks for and
 * what every invoice does: three parts of R$ 100,00 out of R$ 299,99 would be
 * a cent short, so the last one carries it.
 */
export function splitInstallments(total: Cents, count: number): Cents[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const parts = Array<Cents>(count).fill(base);
  parts[count - 1] = total - base * (count - 1);
  return parts;
}

/** Percentage of a value, rounded to the cent. */
export function percentOf(cents: Cents, percent: number): Cents {
  return Math.round((cents * percent) / 100);
}

/** "3× de R$ 100,00" — or the exact amounts when they differ. */
export function installmentPlanLabel(parts: Cents[]): string {
  if (parts.length === 0) return "";
  const allEqual = parts.every((p) => p === parts[0]);
  if (allEqual) return `${parts.length}× de ${formatMoney(parts[0])}`;
  const head = parts.slice(0, -1);
  return `${head.length}× de ${formatMoney(head[0])} + ${formatMoney(parts[parts.length - 1])}`;
}
