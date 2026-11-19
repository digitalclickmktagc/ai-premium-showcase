import type {
  Billing,
  PaymentTerms,
  Proposal,
  ProposalItem,
  ProposalStatus,
  Service,
} from "./types";
import { splitInstallments } from "./money";
import { todayISO } from "./utils";

/**
 * Catalogue and proposals (benchmark spec 06).
 *
 * Every figure here is integer cents, and the two totals are kept apart all
 * the way to the client's screen: a recurring fee and a one-off fee are
 * different promises, and adding them into one number is how an agency ends
 * up arguing about what was agreed.
 */

export const BILLING_LABEL: Record<Billing, string> = {
  mensal: "mensal",
  trimestral: "trimestral",
  semestral: "semestral",
  anual: "anual",
  unica: "única",
  por_hora: "por hora",
};

/** How many months one charge of this kind covers. 0 = not recurring. */
const MONTHS_COVERED: Record<Billing, number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
  unica: 0,
  por_hora: 0,
};

export function isRecurring(billing: Billing): boolean {
  return MONTHS_COVERED[billing] > 0;
}

export function itemTotal(item: ProposalItem): number {
  return Math.round(item.quantity * item.unitPrice);
}

export interface ProposalTotals {
  /** Recurring value normalised to one month, in cents. */
  recurringMonthly: number;
  /** Everything charged once, in cents. */
  oneOff: number;
  /** First-year commitment, for the "what this costs me" line. */
  firstYear: number;
}

/**
 * An annual item of R$ 1.200 is R$ 100 a month — the spec's own example, and
 * the reason the normalisation lives in one tested function instead of in
 * three screens.
 */
export function proposalTotals(items: ProposalItem[]): ProposalTotals {
  let recurringMonthly = 0;
  let oneOff = 0;
  for (const item of items) {
    const total = itemTotal(item);
    const months = MONTHS_COVERED[item.billing];
    if (months > 0) recurringMonthly += Math.round(total / months);
    else oneOff += total;
  }
  return { recurringMonthly, oneOff, firstYear: oneOff + recurringMonthly * 12 };
}

/**
 * Check the payment terms against the one-off total.
 *
 * Only the one-off part is split: a recurring fee is billed every month by
 * definition, so "12 parcelas" of a monthly fee is not a payment plan, it is
 * the fee.
 */
export function validatePaymentTerms(
  terms: PaymentTerms,
  oneOff: number,
): string | null {
  if (terms.entryAmount < 0) return "A entrada não pode ser negativa.";
  if (terms.entryAmount > oneOff)
    return "A entrada é maior que o valor à vista da proposta.";
  if (terms.modality === "parcelado") {
    if (terms.installments < 2 || terms.installments > 60)
      return "O parcelamento vai de 2 a 60 parcelas.";
  }
  if (terms.methods.length === 0) return "Escolha ao menos uma forma de pagamento.";
  return null;
}

/** The installment amounts, which always add back up to the financed part. */
export function installmentPlan(terms: PaymentTerms, oneOff: number): number[] {
  const financed = oneOff - terms.entryAmount;
  if (terms.modality === "a_vista" || financed <= 0) return [];
  return splitInstallments(financed, terms.installments);
}

// ── Numbering ────────────────────────────────────────────────

/**
 * Sequential per year: 2026-001, 2026-002. Assigned when the proposal is
 * first sent, never on a draft — a number handed out and then abandoned
 * leaves a hole the agency has to explain.
 */
export function nextProposalNumber(existing: Proposal[], year = new Date().getFullYear()): string {
  const prefix = `${year}-`;
  const used = existing
    .map((p) => p.number)
    .filter((n): n is string => Boolean(n && n.startsWith(prefix)))
    .map((n) => Number(n.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

// ── State machine ────────────────────────────────────────────

const ALLOWED: Record<ProposalStatus, ProposalStatus[]> = {
  rascunho: ["enviada", "arquivada"],
  enviada: ["aceita", "recusada", "ajuste_pedido", "vencida", "arquivada"],
  ajuste_pedido: ["enviada", "arquivada"],
  vencida: ["enviada", "arquivada"],
  recusada: ["arquivada"],
  // Accepted is the end of the line: read-only, never deleted.
  aceita: [],
  arquivada: ["rascunho", "enviada"],
};

export function canTransition(from: ProposalStatus, to: ProposalStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function isEditable(proposal: Proposal): boolean {
  // An accepted proposal is the record of what was agreed. Nothing touches it.
  return proposal.status !== "aceita";
}

export function isExpired(proposal: Proposal, today = todayISO()): boolean {
  return proposal.status === "enviada" && proposal.validUntil < today;
}

/** Days until it lapses; negative once it has. */
export function daysToExpiry(proposal: Proposal, today = todayISO()): number {
  const ms = new Date(`${proposal.validUntil}T12:00:00`).getTime() -
    new Date(`${today}T12:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

export const EXPIRY_WARNING_DAYS = 7;

export function expiringSoon(proposal: Proposal, today = todayISO()): boolean {
  if (proposal.status !== "enviada") return false;
  const days = daysToExpiry(proposal, today);
  return days >= 0 && days <= EXPIRY_WARNING_DAYS;
}

export const DEFAULT_VALIDITY_DAYS = 15;

export function defaultValidUntil(from = new Date()): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + DEFAULT_VALIDITY_DAYS);
  return d.toISOString().slice(0, 10);
}

// ── Validation ───────────────────────────────────────────────

export function validateProposal(
  p: Pick<Proposal, "title" | "items" | "validUntil" | "clientId" | "leadName">,
): string | null {
  if (!p.title.trim()) return "Dê um título à proposta.";
  if (!p.clientId && !p.leadName?.trim())
    return "Escolha um cliente ou informe para quem é a proposta.";
  if (p.items.length === 0) return "Adicione ao menos um item.";
  if (!p.validUntil) return "Informe até quando a proposta vale.";
  for (const item of p.items) {
    if (!item.description.trim()) return "Todo item precisa de uma descrição.";
    if (item.quantity <= 0) return "A quantidade precisa ser maior que zero.";
    if (item.unitPrice < 0) return "O preço não pode ser negativo.";
  }
  return null;
}

export function itemFromService(service: Service): Omit<ProposalItem, "id"> {
  return {
    serviceId: service.id,
    description: service.name,
    quantity: 1,
    unitPrice: service.price,
    billing: service.billing,
    scope: service.included?.join("\n"),
  };
}

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  ajuste_pedido: "Ajuste pedido",
  aceita: "Aceita",
  recusada: "Recusada",
  vencida: "Vencida",
  arquivada: "Arquivada",
};

export const PROPOSAL_STATUS_COLOR: Record<ProposalStatus, string> = {
  rascunho: "#94a3b8",
  enviada: "#3b82f6",
  ajuste_pedido: "#f59e0b",
  aceita: "#22c55e",
  recusada: "#ef4444",
  vencida: "#a855f7",
  arquivada: "#64748b",
};

export function validateService(
  s: Pick<Service, "name" | "price">,
): string | null {
  if (!s.name.trim()) return "Dê um nome ao serviço.";
  if (s.price < 0) return "O preço não pode ser negativo.";
  return null;
}
