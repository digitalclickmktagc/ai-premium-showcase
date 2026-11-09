import type { BoardStage, Post, PostStatus } from "./types";
import { SELECTABLE_STATUSES, statusConfig } from "./status";

/**
 * Custom board columns (benchmark spec 02).
 *
 * The design decision that makes this safe: a column is not a new kind of
 * status, it is a *name and a position* for one of the statuses the system
 * already understands. `post.status` stays the invariant — the client view,
 * the approval automations and the relationship index keep reading it and
 * never learn that custom columns exist.
 *
 * A calendar with no custom columns behaves exactly as it did before.
 */

export const STAGE_NAME_MAX = 40;
/** More columns than this stops being a board and becomes a spreadsheet. */
export const MAX_STAGES = 12;

/** Categories a column may stand for, in the order a flow usually runs. */
export const STAGE_CATEGORIES: PostStatus[] = SELECTABLE_STATUSES.filter(
  (s) => s !== "deleted",
);

/** How a category reads when explaining what a column means. */
export function categoryLabel(category: BoardStage["category"]): string {
  return statusConfig(category).label;
}

/**
 * The columns to render: the calendar's own, in order, or the standard four
 * presented as columns so the board has one code path.
 */
export function resolveStages(
  calendarId: string,
  custom?: BoardStage[],
): BoardStage[] {
  const mine = (custom ?? [])
    .filter((s) => s.calendarId === calendarId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return mine.length > 0 ? mine : standardStages(calendarId);
}

/** The four built-in stages, shaped as columns. Not stored anywhere. */
export function standardStages(calendarId: string): BoardStage[] {
  return STAGE_CATEGORIES.map((status, i) => ({
    id: `std:${status}`,
    calendarId,
    name: statusConfig(status).label,
    color: statusConfig(status).color,
    category: status,
    order: i,
  }));
}

export function isStandard(stage: BoardStage): boolean {
  return stage.id.startsWith("std:");
}

export function usesCustomStages(calendarId: string, custom?: BoardStage[]): boolean {
  return (custom ?? []).some((s) => s.calendarId === calendarId);
}

/**
 * Which column a card belongs in.
 *
 * A card keeps its `stageId` only while that column still exists and still
 * stands for the card's status — otherwise the status wins, and the card
 * lands in the first column of its own category. That rule is what keeps a
 * deleted column, or a status changed from the edit form, from stranding
 * cards nowhere.
 */
export function stageForPost(post: Post, stages: BoardStage[]): BoardStage | undefined {
  const claimed = stages.find((s) => s.id === post.stageId);
  if (claimed && claimed.category === post.status) return claimed;
  return stages.find((s) => s.category === post.status);
}

/** Group the cards by column, ready to render. Cards with no column are dropped. */
export function groupByStage(
  posts: Post[],
  stages: BoardStage[],
): Map<string, Post[]> {
  const map = new Map<string, Post[]>();
  for (const s of stages) map.set(s.id, []);
  for (const post of posts) {
    const stage = stageForPost(post, stages);
    if (!stage) continue; // e.g. a deleted card while deleted columns are hidden
    map.get(stage.id)!.push(post);
  }
  for (const [, list] of map) list.sort((a, b) => a.date.localeCompare(b.date));
  return map;
}

/**
 * What to write when a card is dropped on a column: the column itself, and
 * the status it stands for. Returns null when nothing would change.
 */
export function dropPatch(
  post: Post,
  stage: BoardStage,
): { status: PostStatus; stageId?: string } | null {
  const nextStageId = isStandard(stage) ? undefined : stage.id;
  const sameStatus = post.status === stage.category;
  const sameStage = (post.stageId ?? undefined) === nextStageId;
  if (sameStatus && sameStage) return null;
  return { status: stage.category, stageId: nextStageId };
}

export function validateStageName(
  name: string,
  existing: BoardStage[],
  selfId?: string,
): string | null {
  const value = name.trim();
  if (!value) return "Dê um nome à coluna.";
  if (value.length > STAGE_NAME_MAX)
    return `O nome passa de ${STAGE_NAME_MAX} caracteres.`;
  const clash = existing.some(
    (s) => s.id !== selfId && s.name.trim().toLowerCase() === value.toLowerCase(),
  );
  if (clash) return "Já existe uma coluna com esse nome.";
  return null;
}

export function canAddStage(existing: BoardStage[]): string | null {
  return existing.length >= MAX_STAGES
    ? `O quadro já tem ${MAX_STAGES} colunas.`
    : null;
}

/**
 * Removing a column is only safe while some other column still stands for the
 * same status — otherwise its cards would have nowhere to land.
 */
export function canRemoveStage(
  stage: BoardStage,
  existing: BoardStage[],
): string | null {
  if (existing.length <= 1) return "O quadro precisa de pelo menos uma coluna.";
  const siblings = existing.filter(
    (s) => s.id !== stage.id && s.category === stage.category,
  );
  if (siblings.length === 0) {
    return `Esta é a única coluna de "${categoryLabel(stage.category)}". Crie outra antes de remover esta.`;
  }
  return null;
}

/** Reorder by moving one column one slot up or down; returns the new order. */
export function moveStage(
  stages: BoardStage[],
  id: string,
  direction: -1 | 1,
): BoardStage[] {
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const i = ordered.findIndex((s) => s.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ordered.length) return ordered;
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  return ordered.map((s, index) => ({ ...s, order: index }));
}
