import type {
  ContactBlock,
  CrmStage,
  CrmTask,
  Deal,
  DealPhase,
  Interaction,
} from "./types";
import { todayISO, uid } from "./utils";

/**
 * CRM with a prospecting phase (benchmark spec 09).
 *
 * One entity walks both phases. A prospect and an opportunity are the same
 * business at different temperatures, and keeping two registers of the same
 * company is how an agency ends up calling someone twice with two stories.
 */

export const TEMPERATURE_BANDS = { quente: 70, morno: 40 } as const;

export type Temperature = "quente" | "morno" | "frio";

export function temperatureOf(score = 0): Temperature {
  if (score >= TEMPERATURE_BANDS.quente) return "quente";
  if (score >= TEMPERATURE_BANDS.morno) return "morno";
  return "frio";
}

export const TEMPERATURE_COLOR: Record<Temperature, string> = {
  quente: "#ef4444",
  morno: "#f59e0b",
  frio: "#38bdf8",
};

/** The default funnels, as the spec describes them. */
export function defaultStages(): CrmStage[] {
  const prospect: [string, StageShape][] = [
    ["A abordar", { kind: "aberta", p: 5 }],
    ["Abordado", { kind: "aberta", p: 10 }],
    ["Respondeu", { kind: "aberta", p: 20 }],
    ["Qualificado", { kind: "aberta", p: 30 }],
  ];
  const opportunity: [string, StageShape][] = [
    ["Novo", { kind: "aberta", p: 10 }],
    ["Contato feito", { kind: "aberta", p: 20 }],
    ["Diagnóstico", { kind: "aberta", p: 40 }],
    ["Proposta", { kind: "aberta", p: 60, proposal: true }],
    ["Negociação", { kind: "aberta", p: 80 }],
    ["Ganho", { kind: "ganho", p: 100 }],
    ["Perdido", { kind: "perda", p: 0 }],
  ];
  return [
    ...prospect.map((s, i) => toStage("prospeccao", s, i)),
    ...opportunity.map((s, i) => toStage("oportunidade", s, i)),
  ];
}

interface StageShape {
  kind: CrmStage["kind"];
  p: number;
  proposal?: boolean;
}

function toStage(phase: DealPhase, [name, shape]: [string, StageShape], order: number): CrmStage {
  return {
    id: `stage:${phase}:${order}`,
    phase,
    name,
    order,
    kind: shape.kind,
    defaultProbability: shape.p,
    requiresProposal: shape.proposal,
  };
}

export function stagesOf(stages: CrmStage[], phase: DealPhase): CrmStage[] {
  return stages.filter((s) => s.phase === phase).sort((a, b) => a.order - b.order);
}

// ── Qualification ────────────────────────────────────────────

export interface Criterion {
  key: string;
  label: string;
  weight: number;
  /** Whether this deal meets it. */
  met: (deal: Deal) => boolean;
}

/**
 * The default criteria. They are deliberately things the agency can see from
 * the record itself — a score that needs a meeting to compute is not a score,
 * it is a meeting.
 */
export const DEFAULT_CRITERIA: Criterion[] = [
  {
    key: "contato",
    label: "Tem contato com e-mail ou telefone",
    weight: 20,
    met: (d) => d.contacts.some((c) => Boolean(c.email || c.phone)),
  },
  {
    key: "empresa",
    label: "Empresa identificada",
    weight: 15,
    met: (d) => Boolean(d.company?.trim()),
  },
  {
    key: "segmento",
    label: "Segmento conhecido",
    weight: 15,
    met: (d) => Boolean(d.segment?.trim()),
  },
  {
    key: "valor",
    label: "Valor estimado",
    weight: 25,
    met: (d) => d.recurringValue > 0 || d.oneOffValue > 0,
  },
  {
    key: "proximo_passo",
    label: "Próximo passo marcado",
    weight: 15,
    met: (d) => Boolean(d.nextStepOn),
  },
  {
    key: "respondeu",
    label: "Já respondeu alguma abordagem",
    weight: 10,
    met: (d) => Boolean(d.lastContactOn),
  },
];

export function qualificationScore(deal: Deal, criteria = DEFAULT_CRITERIA): number {
  const total = criteria.reduce((sum, c) => sum + (c.met(deal) ? c.weight : 0), 0);
  return Math.max(0, Math.min(100, total));
}

// ── Probability and forecast ─────────────────────────────────

export function probabilityOf(deal: Deal, stages: CrmStage[]): number {
  if (typeof deal.probability === "number") return deal.probability;
  return stages.find((s) => s.id === deal.stageId)?.defaultProbability ?? 0;
}

/** Monthly value of a deal: recurring plus the one-off spread over a year. */
export function dealMonthlyValue(deal: Deal): number {
  return deal.recurringValue + Math.round(deal.oneOffValue / 12);
}

/**
 * Weighted pipeline. The spec is firm that this is a separate line in the
 * cash-flow report and never part of its totals — a forecast added to real
 * money is how a month gets spent twice.
 */
export function weightedPipeline(deals: Deal[], stages: CrmStage[]): number {
  return deals
    .filter((d) => d.status === "aberto")
    .reduce(
      (sum, d) => sum + Math.round((dealMonthlyValue(d) * probabilityOf(d, stages)) / 100),
      0,
    );
}

// ── Cadence ──────────────────────────────────────────────────

/** Days to wait before the next attempt, by attempt number (spec default). */
export const NO_REPLY_CADENCE = [2, 4, 7];
export const MAX_ATTEMPTS = NO_REPLY_CADENCE.length;

export function attemptsWithoutReply(interactions: Interaction[], dealId: string): number {
  const ofDeal = interactions
    .filter((i) => i.dealId === dealId && i.kind !== "nota")
    .sort((a, b) => a.at.localeCompare(b.at));
  let attempts = 0;
  for (const i of ofDeal) {
    if (i.answered) attempts = 0;
    else attempts += 1;
  }
  return attempts;
}

export interface CadenceAdvice {
  attempts: number;
  /** When to try again; null once the attempts run out. */
  nextOn: string | null;
  /** True when the spec's rule says to give up and mark it lost. */
  giveUp: boolean;
}

/**
 * What to do next with someone who has not replied. Advice, not an action:
 * marking a deal lost is the agency's call, and the UI offers it rather than
 * doing it behind their back.
 */
export function cadenceAdvice(
  interactions: Interaction[],
  dealId: string,
  today = todayISO(),
): CadenceAdvice {
  const attempts = attemptsWithoutReply(interactions, dealId);
  if (attempts === 0) return { attempts, nextOn: null, giveUp: false };
  if (attempts >= MAX_ATTEMPTS) return { attempts, nextOn: null, giveUp: true };

  const last = interactions
    .filter((i) => i.dealId === dealId && i.kind !== "nota")
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const wait = NO_REPLY_CADENCE[attempts - 1] ?? NO_REPLY_CADENCE[MAX_ATTEMPTS - 1];
  const base = last ? last.at.slice(0, 10) : today;
  const next = new Date(`${base}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + wait);
  return { attempts, nextOn: next.toISOString().slice(0, 10), giveUp: false };
}

// ── Blocklist ────────────────────────────────────────────────

/**
 * Whether this contact must be left alone. A blocked domain blocks every
 * address under it: someone who asked not to be contacted did not mean
 * "try my colleague instead".
 */
export function isBlocked(
  value: string,
  blocks: ContactBlock[],
): ContactBlock | undefined {
  const needle = value.trim().toLowerCase();
  if (!needle) return undefined;
  const digits = needle.replace(/\D/g, "");
  return blocks.find((b) => {
    const v = b.value.trim().toLowerCase();
    if (b.kind === "email") return v === needle;
    if (b.kind === "dominio") return needle.endsWith(`@${v}`) || needle === v;
    return digits.length > 0 && v.replace(/\D/g, "") === digits;
  });
}

export function dealIsBlocked(deal: Deal, blocks: ContactBlock[]): ContactBlock | undefined {
  for (const c of deal.contacts) {
    const hit = isBlocked(c.email ?? "", blocks) ?? isBlocked(c.phone ?? "", blocks);
    if (hit) return hit;
  }
  return undefined;
}

// ── Deduplication on import ──────────────────────────────────

export interface ImportRow {
  name: string;
  company?: string;
  document?: string;
  email?: string;
  phone?: string;
}

/**
 * Reads a contact list: CSV with a header in any column order, or the VCF an
 * address book exports. Columns are found by name because no two exports
 * agree on their order.
 */
export function parseContactRows(text: string): { rows: ImportRow[]; errors: string[] } {
  if (/BEGIN:VCARD/i.test(text)) return parseVcf(text);

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], errors: ["Arquivo vazio."] };

  const separator = [";", ",", "\t"]
    .map((sep) => ({ sep, count: lines[0].split(sep).length }))
    .sort((a, b) => b.count - a.count)[0].sep;

  const header = splitRow(lines[0], separator).map((h) => h.toLowerCase());
  const at = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n)));

  let nameAt = at("nome", "name", "razão", "razao");
  let companyAt = at("empresa", "company", "fantasia");
  let documentAt = at("documento", "cnpj", "cpf", "document");
  let emailAt = at("email", "e-mail");
  let phoneAt = at("telefone", "celular", "phone", "whats");

  const hasHeader = nameAt >= 0 || emailAt >= 0 || phoneAt >= 0;
  const body = hasHeader ? lines.slice(1) : lines;
  if (!hasHeader) {
    nameAt = 0;
    emailAt = 1;
    phoneAt = 2;
    companyAt = -1;
    documentAt = -1;
  }

  const rows: ImportRow[] = [];
  const errors: string[] = [];
  body.forEach((raw, index) => {
    const cells = splitRow(raw, separator);
    const pick = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const name = pick(nameAt) || pick(companyAt) || pick(emailAt);
    if (!name) {
      errors.push(`Linha ${index + (hasHeader ? 2 : 1)}: sem nome e sem contato.`);
      return;
    }
    rows.push({
      name,
      company: pick(companyAt) || undefined,
      document: pick(documentAt) || undefined,
      email: pick(emailAt) || undefined,
      phone: pick(phoneAt) || undefined,
    });
  });
  return { rows, errors };
}

function splitRow(line: string, separator: string): string[] {
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

function parseVcf(text: string): { rows: ImportRow[]; errors: string[] } {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  cards.forEach((card, index) => {
    const field = (tag: string) =>
      card.match(new RegExp(`^${tag}[^:\r\n]*:(.*)$`, "im"))?.[1]?.trim();
    const name = field("FN") || field("N")?.replace(/;+/g, " ").trim() || "";
    const org = field("ORG")?.replace(/;+$/, "");
    if (!name && !org) {
      errors.push(`Cartão ${index + 1}: sem nome.`);
      return;
    }
    rows.push({
      name: name || org!,
      company: org || undefined,
      email: field("EMAIL") || undefined,
      phone: field("TEL") || undefined,
    });
  });
  return { rows, errors };
}

export interface ImportPreview {
  row: ImportRow;
  /** An existing deal this row matches. */
  duplicateOf?: string;
  /** Same name, different everything: a warning, not a match. */
  warning?: string;
  blocked?: string;
}

/**
 * What an import would do, before it does it. Deduplication is by document,
 * then e-mail, then phone — never by name alone, which the spec is explicit
 * about and which anyone who has met two João Silvas understands.
 */
export function previewImport(
  rows: ImportRow[],
  deals: Deal[],
  blocks: ContactBlock[],
): ImportPreview[] {
  const norm = (v?: string) => (v ?? "").trim().toLowerCase();
  const digits = (v?: string) => (v ?? "").replace(/\D/g, "");

  return rows.map((row) => {
    const blockedBy = isBlocked(row.email ?? "", blocks) ?? isBlocked(row.phone ?? "", blocks);
    if (blockedBy) {
      return { row, blocked: `Contato bloqueado (${blockedBy.reason ?? "sem motivo registrado"}).` };
    }

    const byDocument =
      digits(row.document).length > 0 &&
      deals.find((d) => digits(d.document) === digits(row.document));
    const byEmail =
      norm(row.email).length > 0 &&
      deals.find((d) => d.contacts.some((c) => norm(c.email) === norm(row.email)));
    const byPhone =
      digits(row.phone).length > 0 &&
      deals.find((d) => d.contacts.some((c) => digits(c.phone) === digits(row.phone)));

    const duplicate = byDocument || byEmail || byPhone;
    if (duplicate) return { row, duplicateOf: (duplicate as Deal).id };

    const sameName = deals.find((d) => norm(d.name) === norm(row.name));
    if (sameName) {
      return { row, warning: `Já existe "${sameName.name}", mas com outros dados.` };
    }
    return { row };
  });
}

// ── Transitions and validation ───────────────────────────────

export function promoteToOpportunity(deal: Deal, stages: CrmStage[]): Deal {
  const first = stagesOf(stages, "oportunidade")[0];
  return {
    ...deal,
    phase: "oportunidade",
    stageId: first?.id ?? deal.stageId,
    updatedAt: new Date().toISOString(),
  };
}

export function canEnterStage(
  deal: Deal,
  stage: CrmStage,
): { ok: true } | { ok: false; reason: string } {
  if (stage.requiresProposal && !deal.proposalId) {
    return { ok: false, reason: "Esta etapa exige uma proposta vinculada." };
  }
  return { ok: true };
}

export function validateDeal(deal: Pick<Deal, "name">): string | null {
  if (!deal.name.trim()) return "Dê um nome ao negócio.";
  return null;
}

export function validateInteraction(i: Pick<Interaction, "content">): string | null {
  if (!i.content.trim()) return "Escreva o que aconteceu.";
  return null;
}

export function newTask(dealId: string, title: string, dueOn: string): CrmTask {
  return { id: uid("task"), dealId, title: title.trim(), dueOn };
}

/** Deals with nothing scheduled — the spec's "sem próximo passo" list. */
export function withoutNextStep(deals: Deal[], tasks: CrmTask[]): Deal[] {
  const scheduled = new Set(tasks.filter((t) => !t.doneAt).map((t) => t.dealId));
  return deals.filter(
    (d) => d.status === "aberto" && !d.nextStepOn && !scheduled.has(d.id),
  );
}

export function stalled(deals: Deal[], days: number, today = todayISO()): Deal[] {
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() - days);
  const cut = limit.toISOString().slice(0, 10);
  return deals.filter(
    (d) => d.status === "aberto" && (d.lastContactOn ?? d.createdAt.slice(0, 10)) < cut,
  );
}
