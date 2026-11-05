import type React from "react";
import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalResult,
  ApprovalState,
  Post,
} from "./types";

export const APPROVAL_COMMENT_MAX = 2000;
/** How long a verification code stays valid. */
export const APPROVAL_CODE_TTL_MS = 10 * 60 * 1000;

export interface ApprovalStateConfig {
  value: ApprovalState;
  label: string;
  color: string;
  badgeClass: string;
}

export const APPROVAL_CONFIG: Record<ApprovalState, ApprovalStateConfig> = {
  none: {
    value: "none",
    label: "Não enviado",
    color: "#94a3b8",
    badgeClass: "bg-slate-500/15 text-slate-200 border border-slate-400/30",
  },
  pending: {
    value: "pending",
    label: "Aguardando cliente",
    color: "#a855f7",
    badgeClass: "bg-purple-500/15 text-purple-200 border border-purple-400/30",
  },
  approved: {
    value: "approved",
    label: "Aprovado",
    color: "#22c55e",
    badgeClass: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30",
  },
  changes: {
    value: "changes",
    label: "Ajuste solicitado",
    color: "#f59e0b",
    badgeClass: "bg-amber-500/15 text-amber-200 border border-amber-400/30",
  },
  rejected: {
    value: "rejected",
    label: "Reprovado",
    color: "#ef4444",
    badgeClass: "bg-rose-500/15 text-rose-200 border border-rose-400/30",
  },
};

export function approvalConfig(state: ApprovalState): ApprovalStateConfig {
  return APPROVAL_CONFIG[state] ?? APPROVAL_CONFIG.none;
}

/** The decision that currently governs the request (latest of the current round). */
export function currentDecision(
  approval?: ApprovalRequest | null,
): ApprovalDecision | undefined {
  if (!approval || approval.round < 1) return undefined;
  const ofRound = approval.decisions.filter((d) => d.round === approval.round);
  if (ofRound.length === 0) return undefined;
  // Latest wins: the client may change their mind within a round.
  return ofRound.reduce((a, b) => (a.at >= b.at ? a : b));
}

/**
 * Derive the review state. Per the spec the state is always computed from the
 * decisions in force, never stored, so it cannot drift out of sync.
 */
export function approvalState(approval?: ApprovalRequest | null): ApprovalState {
  if (!approval || approval.round < 1) return "none";
  const decision = currentDecision(approval);
  if (!decision) return "pending";
  return decision.result === "approved"
    ? "approved"
    : decision.result === "changes"
      ? "changes"
      : "rejected";
}

/** Convenience for a whole post. */
export function postApprovalState(post: Pick<Post, "approval">): ApprovalState {
  return approvalState(post.approval);
}

/** A client may still decide while the round is open or to revise their call. */
export function canClientDecide(approval?: ApprovalRequest | null): boolean {
  return Boolean(approval && approval.round >= 1);
}

/**
 * Validate a decision before it is recorded.
 * Returns an error message, or null when the decision is acceptable.
 */
export function validateDecision(input: {
  result: ApprovalResult;
  comment?: string;
  decidedByName?: string;
}): string | null {
  if (!input.decidedByName || !input.decidedByName.trim()) {
    return "Informe seu nome para registrar a decisão.";
  }
  const needsComment = input.result === "changes" || input.result === "rejected";
  const comment = input.comment?.trim() ?? "";
  if (needsComment && comment.length === 0) {
    return input.result === "changes"
      ? "Descreva o ajuste que você precisa."
      : "Explique o motivo da reprovação.";
  }
  if (comment.length > APPROVAL_COMMENT_MAX) {
    return `O comentário passa de ${APPROVAL_COMMENT_MAX} caracteres.`;
  }
  return null;
}

/**
 * Mask an e-mail so the client can confirm where the code goes without the
 * full address being exposed through the public share view.
 */
export function maskEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const value = email.trim();
  const at = value.lastIndexOf("@");
  if (at <= 0) return undefined;
  const user = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!domain.includes(".")) return undefined;
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}${"*".repeat(Math.max(user.length - head.length, 1))}@${domain}`;
}

/** Six-digit numeric code, zero-padded, from a cryptographic source. */
export function generateApprovalCode(): string {
  const buf = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    buf[0] = Math.floor(Math.random() * 0xffffffff);
  }
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/** Constant-time-ish comparison so a wrong code leaks no timing signal. */
export function codesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Inline styles for a status/approval pill that stay legible in both themes.
 *
 * The text is mixed toward `--badge-ink` (white on dark, black on light), so a
 * single accent colour works on either background instead of needing a
 * hand-picked shade per theme.
 */
export function toneStyles(color: string): React.CSSProperties {
  return {
    backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 42%, transparent)`,
    color: `color-mix(in srgb, ${color} 62%, var(--badge-ink))`,
  };
}
