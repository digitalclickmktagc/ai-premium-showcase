import type { PostStatus } from "./types";

export interface StatusConfig {
  value: PostStatus;
  /** Human label (pt-BR). */
  label: string;
  /** Solid dot / chip background color (hex) used on the calendar grid. */
  color: string;
  /** Tailwind classes for a filled badge on the dark UI. */
  badgeClass: string;
  /** Whether the post should render struck-through / dimmed (deleted). */
  muted?: boolean;
}

/**
 * Status palette (spec 4.2 / 4.4):
 *  A Fazer     → cinza
 *  Feito       → azul
 *  Publicado   → verde
 *  Reagendado  → amarelo
 *  Deletado    → vermelho + riscado
 */
export const STATUS_CONFIG: Record<PostStatus, StatusConfig> = {
  todo: {
    value: "todo",
    label: "A Fazer",
    color: "#94a3b8", // slate-400
    badgeClass: "bg-slate-500/15 text-slate-200 border border-slate-400/30",
  },
  done: {
    value: "done",
    label: "Feito",
    color: "#3b82f6", // blue-500
    badgeClass: "bg-blue-500/15 text-blue-200 border border-blue-400/30",
  },
  published: {
    value: "published",
    label: "Publicado",
    color: "#22c55e", // green-500
    badgeClass: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30",
  },
  rescheduled: {
    value: "rescheduled",
    label: "Reagendado",
    color: "#f59e0b", // amber-500
    badgeClass: "bg-amber-500/15 text-amber-200 border border-amber-400/30",
  },
  deleted: {
    value: "deleted",
    label: "Deletado",
    color: "#ef4444", // red-500
    badgeClass: "bg-rose-500/15 text-rose-200 border border-rose-400/30",
    muted: true,
  },
};

/** Statuses an admin can pick from directly (deleted is handled via delete/restore). */
export const SELECTABLE_STATUSES: PostStatus[] = [
  "todo",
  "done",
  "published",
  "rescheduled",
];

/** All statuses, ordered for legends. */
export const ALL_STATUSES: PostStatus[] = [
  "todo",
  "done",
  "published",
  "rescheduled",
  "deleted",
];

export function statusConfig(status: PostStatus): StatusConfig {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.todo;
}
