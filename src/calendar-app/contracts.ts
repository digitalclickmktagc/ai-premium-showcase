import type {
  Contract,
  ContractParty,
  ContractStatus,
  PartyRole,
  Signature,
} from "./types";

/**
 * Contracts and electronic signature (benchmark spec 07).
 *
 * The owner chose a *simple* electronic signature: a typed name and document
 * plus evidence of the act (when, from what browser) — not an ICP-Brasil
 * certificate. What makes it hold up is the hash: every signature records the
 * SHA-256 of the exact text it was given, and a contract whose signatures
 * disagree with its text can never take effect. That is the whole point of
 * freezing the text at generation and refusing to touch it afterwards.
 *
 * Legal review is still pending (decisions C1 and C2) — this models the rules
 * the owner chose; it does not pronounce on whether they suffice in court.
 */

export const PARTY_ROLE_LABEL: Record<PartyRole, string> = {
  contratante: "Contratante",
  contratada: "Contratada",
  testemunha: "Testemunha",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  rascunho: "Rascunho",
  gerado: "Gerado",
  aguardando_partes: "Aguardando assinaturas",
  parcialmente_assinado: "Parcialmente assinado",
  vigente: "Vigente",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

export const CONTRACT_STATUS_COLOR: Record<ContractStatus, string> = {
  rascunho: "#94a3b8",
  gerado: "#38bdf8",
  aguardando_partes: "#f59e0b",
  parcialmente_assinado: "#a855f7",
  vigente: "#22c55e",
  encerrado: "#64748b",
  cancelado: "#ef4444",
};

/** SHA-256 of the text, hex. The evidence the whole model rests on. */
export async function hashText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Template rendering ───────────────────────────────────────

export interface TemplateVars {
  [key: string]: string | undefined;
}

/**
 * Replace `{{chave}}` with its value.
 *
 * An unknown variable is left visible as `{{chave}}` rather than silently
 * blanked: a contract that quietly says "entre  e " is worse than one that
 * obviously still has a placeholder in it.
 */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, key: string) => {
    const value = vars[key];
    return value === undefined || value === "" ? whole : value;
  });
}

/** Variables still unresolved in a rendered text. */
export function missingVariables(rendered: string): string[] {
  return [...rendered.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]);
}

export const TEMPLATE_VARIABLES = [
  "cliente.nome",
  "cliente.documento",
  "cliente.email",
  "agencia.nome",
  "agencia.documento",
  "servicos",
  "valor.recorrente",
  "valor.unico",
  "vigencia.inicio",
  "vigencia.fim",
  "hoje",
] as const;

// ── Parties ──────────────────────────────────────────────────

/**
 * The spec requires at least one contratante and one contratada. The owner
 * additionally requires witnesses (decision C2), which is what makes the
 * document an extrajudicial enforceable instrument under Brazilian law.
 */
export function validateParties(
  parties: ContractParty[],
  { requireWitnesses = true } = {},
): string | null {
  const count = (role: PartyRole) => parties.filter((p) => p.role === role).length;
  if (count("contratante") < 1) return "O contrato precisa de um contratante.";
  if (count("contratada") < 1) return "O contrato precisa da contratada.";
  if (requireWitnesses && count("testemunha") < 2)
    return "Como decidido, o contrato precisa de duas testemunhas.";
  for (const p of parties) {
    if (!p.name.trim()) return "Toda parte precisa de nome.";
  }
  return null;
}

export function requiredParties(contract: Contract): ContractParty[] {
  return contract.parties.filter((p) => p.required);
}

export function hasSigned(contract: Contract, partyId: string): boolean {
  return contract.signatures.some((s) => s.partyId === partyId);
}

export function signatureOf(contract: Contract, partyId: string): Signature | undefined {
  return contract.signatures.find((s) => s.partyId === partyId);
}

/** Who still has to sign, in the order the spec asks for. */
export function pendingParties(contract: Contract): ContractParty[] {
  return [...contract.parties]
    .filter((p) => p.required && !hasSigned(contract, p.id))
    .sort((a, b) => a.order - b.order);
}

// ── State ────────────────────────────────────────────────────

/**
 * Every signature must carry the hash of the text it signed. One that does
 * not match is not a technicality — it means somebody signed a different
 * document, and the contract must not take effect.
 */
export function signaturesMatchText(contract: Contract): boolean {
  return contract.signatures.every((s) => s.signedTextHash === contract.textHash);
}

/** The status the contract should be in, given its signatures. */
export function deriveStatus(contract: Contract): ContractStatus {
  if (contract.status === "cancelado" || contract.status === "encerrado")
    return contract.status;
  if (contract.status === "rascunho") return "rascunho";
  if (contract.signatures.length === 0) return "aguardando_partes";
  if (!signaturesMatchText(contract)) return "parcialmente_assinado";
  // The operational trigger is every required party, as decided (D14).
  return pendingParties(contract).length === 0 ? "vigente" : "parcialmente_assinado";
}

export function isEffective(contract: Contract): boolean {
  return deriveStatus(contract) === "vigente";
}

/**
 * Once anyone has signed, the text is frozen. Correcting it means cancelling
 * and generating a new contract — which is the spec's rule and the only one
 * that keeps the hashes meaningful.
 */
export function canEditText(contract: Contract): boolean {
  return contract.signatures.length === 0 && contract.status !== "cancelado";
}

export function validateSignature(input: {
  typedName: string;
  typedDocument: string;
}): string | null {
  if (input.typedName.trim().length < 3) return "Digite seu nome completo.";
  const doc = input.typedDocument.replace(/\D/g, "");
  if (doc.length !== 11 && doc.length !== 14)
    return "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
  return null;
}

/** Days until renewal is due; null when the contract has no end date. */
export function daysToRenewal(contract: Contract, today: string): number | null {
  if (!contract.endsOn) return null;
  const ms =
    new Date(`${contract.endsOn}T12:00:00`).getTime() -
    new Date(`${today}T12:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

export function needsRenewalNotice(contract: Contract, today: string): boolean {
  if (deriveStatus(contract) !== "vigente") return false;
  const days = daysToRenewal(contract, today);
  return days !== null && days <= contract.renewNoticeDays;
}

export const DEFAULT_RENEW_NOTICE_DAYS = 30;

/** The evidence page that goes with a signed contract. */
export function evidenceSummary(contract: Contract): string[] {
  return contract.parties.map((party) => {
    const sig = signatureOf(contract, party.id);
    if (!sig) return `${PARTY_ROLE_LABEL[party.role]}: ${party.name} — não assinou`;
    return [
      `${PARTY_ROLE_LABEL[party.role]}: ${sig.typedName}`,
      `documento ${sig.typedDocument}`,
      `em ${sig.at}`,
      sig.agent ? `agente ${sig.agent}` : null,
      `hash ${sig.signedTextHash.slice(0, 16)}…`,
    ]
      .filter(Boolean)
      .join(" · ");
  });
}
