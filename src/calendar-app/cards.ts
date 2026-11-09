import type {
  ChecklistItem,
  PostAttachment,
  PostComment,
  TimeEntry,
} from "./types";
import { safeExternalUrl, uid } from "./utils";

/**
 * The card's production workspace (benchmark spec 02 / núcleo mínimo item 5):
 * checklist, internal comments, attachments and logged time.
 *
 * Everything here is pure, so the rules can be tested without a backend and
 * without a browser. The components only compose the new array and hand it to
 * `updatePost` — the same path every other field already uses.
 */

export const COMMENT_MAX = 2000;
export const CHECKLIST_TEXT_MAX = 200;
export const ATTACHMENT_NAME_MAX = 120;
/** A day of work on one card is already suspicious; a week is a typo. */
export const TIME_ENTRY_MAX_MINUTES = 24 * 60;

// ── Checklist ────────────────────────────────────────────────
export function newChecklistItem(text: string): ChecklistItem {
  return { id: uid("chk"), text: text.trim(), done: false };
}

export function validateChecklistText(text: string): string | null {
  const value = text.trim();
  if (!value) return "Escreva o item antes de adicionar.";
  if (value.length > CHECKLIST_TEXT_MAX)
    return `O item passa de ${CHECKLIST_TEXT_MAX} caracteres.`;
  return null;
}

export interface ChecklistProgress {
  done: number;
  total: number;
  /** 0–100, rounded. 0 when the list is empty. */
  percent: number;
  complete: boolean;
}

export function checklistProgress(items?: ChecklistItem[]): ChecklistProgress {
  const total = items?.length ?? 0;
  const done = items?.filter((i) => i.done).length ?? 0;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    // An empty checklist is not a finished one.
    complete: total > 0 && done === total,
  };
}

export function toggleChecklistItem(
  items: ChecklistItem[],
  id: string,
): ChecklistItem[] {
  return items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
}

// ── Comments ─────────────────────────────────────────────────
export function validateComment(body: string): string | null {
  const value = body.trim();
  if (!value) return "Escreva o comentário antes de enviar.";
  if (value.length > COMMENT_MAX)
    return `O comentário passa de ${COMMENT_MAX} caracteres.`;
  return null;
}

export function newComment(body: string, author: string): PostComment {
  return {
    id: uid("cmt"),
    author: author.trim() || "Equipe",
    body: body.trim(),
    at: new Date().toISOString(),
  };
}

/** Newest first — a card's latest word is the one worth reading. */
export function sortComments(comments?: PostComment[]): PostComment[] {
  return [...(comments ?? [])].sort((a, b) => b.at.localeCompare(a.at));
}

// ── Attachments ──────────────────────────────────────────────
/**
 * Attachments are links, not uploaded bytes: a real upload needs Supabase
 * Storage with its own bucket and policies. The URL goes through the same
 * allow-list the client-facing link uses, so a `javascript:` attachment can
 * never become a click.
 */
export function buildAttachment(
  name: string,
  url: string,
): { attachment: PostAttachment } | { error: string } {
  const safe = safeExternalUrl(url);
  if (!safe) return { error: "Informe um endereço válido (http ou https)." };
  const label = name.trim() || hostOf(safe);
  if (label.length > ATTACHMENT_NAME_MAX)
    return { error: `O nome passa de ${ATTACHMENT_NAME_MAX} caracteres.` };
  return {
    attachment: { id: uid("att"), name: label, url: safe, at: new Date().toISOString() },
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "anexo";
  }
}

// ── Time ─────────────────────────────────────────────────────
/**
 * Read a duration the way a person writes one: "90", "1h30", "1:30", "2h",
 * "45m", "1,5h". Returns minutes, or null when it cannot be read.
 */
export function parseDuration(raw: string): number | null {
  const value = raw.trim().toLowerCase().replace(",", ".");
  if (!value) return null;

  // 1:30
  const clock = value.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  // 1h30 / 1h / 1.5h
  const hm = value.match(/^(\d+(?:\.\d+)?)\s*h\s*(\d{1,2})?$/);
  if (hm) {
    const hours = Number(hm[1]);
    const mins = hm[2] ? Number(hm[2]) : 0;
    if (mins > 59) return null;
    return Math.round(hours * 60) + mins;
  }

  // 45m / 45min
  const m = value.match(/^(\d+)\s*m(in)?$/);
  if (m) return Number(m[1]);

  // plain number = minutes
  const plain = value.match(/^\d+$/);
  if (plain) return Number(value);

  return null;
}

export function validateDuration(raw: string): string | null {
  const minutes = parseDuration(raw);
  if (minutes === null) return 'Não entendi o tempo. Use "90", "1h30" ou "1:30".';
  if (minutes <= 0) return "O tempo precisa ser maior que zero.";
  if (minutes > TIME_ENTRY_MAX_MINUTES)
    return "Mais de 24 horas num card só pode ser engano.";
  return null;
}

export function newTimeEntry(minutes: number, note?: string): TimeEntry {
  return {
    id: uid("time"),
    minutes,
    note: note?.trim() || undefined,
    at: new Date().toISOString(),
  };
}

export function totalMinutes(entries?: TimeEntry[]): number {
  return (entries ?? []).reduce((sum, e) => sum + (e.minutes || 0), 0);
}

/** "1h30", "45min", "—" for nothing. */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
