import type {
  CreatePostInput,
  FunnelStage,
  MonthlyPlan,
  PautaItem,
  Pillar,
} from "./types";

/**
 * Pauta única (benchmark ficha 17, item F17a).
 *
 * The benchmark keeps five calendars: planejamento mensal, planejamento
 * interno, calendário de stories, calendário de aprovação and calendário de
 * publicação. The same post is typed in up to five places and the versions
 * drift apart. Its own critique asks for one entity with views — that is what
 * `PautaItem` is. A pauta item is planning; it becomes a card when the team
 * decides to produce it, and from then on the card is the single truth.
 *
 * The approval link each tool had is deliberately absent too: the card goes
 * to the client through the one external-approval service the app already
 * has (spec 03). One artefact, one way of asking.
 */

export const FUNNEL_STAGES: FunnelStage[] = [
  "descoberta",
  "interesse",
  "conversao",
  "fidelizacao",
];

export const FUNNEL_LABEL: Record<FunnelStage, string> = {
  descoberta: "Descoberta",
  interesse: "Interesse",
  conversao: "Conversão",
  fidelizacao: "Fidelização",
};

/** An empty funnel split, used by a plan that has not been filled yet. */
export function emptyFunnel(): Record<FunnelStage, number> {
  return { descoberta: 0, interesse: 0, conversao: 0, fidelizacao: 0 };
}

export function sumShares(pillars: Pillar[]): number {
  return pillars.reduce((sum, p) => sum + p.share, 0);
}

export function sumFunnel(funnel: Record<FunnelStage, number>): number {
  return FUNNEL_STAGES.reduce((sum, s) => sum + (funnel[s] ?? 0), 0);
}

/**
 * What stops a plan from being validated. An empty plan is a legitimate
 * draft, so the rules only bite once something was filled in.
 */
export function validatePlan(plan: MonthlyPlan): string | null {
  if (!/^\d{4}-\d{2}$/.test(plan.month)) return "Mês inválido.";
  if (!plan.clientId) return "O planejamento é de um cliente.";
  if (plan.pillars.some((p) => !p.name.trim())) return "Dê um nome a cada pilar.";
  if (plan.pillars.some((p) => p.share < 0 || p.share > 100))
    return "A fatia de cada pilar vai de 0 a 100.";
  if (plan.pillars.length > 0 && sumShares(plan.pillars) !== 100)
    return `Os pilares precisam somar 100% (somam ${sumShares(plan.pillars)}%).`;
  const funnel = sumFunnel(plan.funnel);
  if (funnel !== 0 && funnel !== 100)
    return `O foco do funil precisa somar 100% (soma ${funnel}%).`;
  return null;
}

/** A validated plan is frozen until someone reopens it, on purpose. */
export function canEditPlan(plan: MonthlyPlan): boolean {
  return plan.status !== "validado";
}

export function validatePlanItem(item: PautaItem): string | null {
  if (!item.title.trim()) return "Dê um título à pauta.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return "Data inválida.";
  if (!item.clientId) return "A pauta é de um cliente.";
  return null;
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** The items of one client in one month, in the order they happen. */
export function monthItems(
  items: PautaItem[],
  clientId: string,
  month: string,
): PautaItem[] {
  return items
    .filter((i) => i.clientId === clientId && monthOf(i.date) === month)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

const DAY_MS = 86400000;

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The ficha's ceiling: a weekly repetition runs for at most 12 weeks. */
export const MAX_WEEKS = 12;

/**
 * Repeats an item once a week. The original is the first of the series and
 * keeps its id, so repeating twice does not orphan what was already created.
 */
export function expandWeekly(
  item: PautaItem,
  weeks: number,
  now = new Date().toISOString(),
  newId: () => string = () => crypto.randomUUID(),
): PautaItem[] {
  const count = Math.max(1, Math.min(Math.trunc(weeks), MAX_WEEKS));
  const seriesId = item.seriesId ?? newId();
  const first: PautaItem = { ...item, seriesId, updatedAt: now };
  const rest: PautaItem[] = [];
  for (let week = 1; week < count; week += 1) {
    rest.push({
      ...item,
      id: newId(),
      seriesId,
      date: addDays(item.date, week * 7),
      // A repeat is a fresh plan: it carries no card and no client decision.
      status: "ideia",
      postId: undefined,
      calendarId: undefined,
      createdAt: now,
      updatedAt: now,
    });
  }
  return [first, ...rest];
}

/**
 * "Só esta" or "esta e as próximas". Deleting the whole future of a series
 * never touches an item that already became a card: that one belongs to the
 * calendar now, and removing the plan behind it would be a surprise.
 */
export function seriesToRemove(
  items: PautaItem[],
  item: PautaItem,
  scope: "uma" | "proximas",
): PautaItem[] {
  if (scope === "uma" || !item.seriesId) return item.postId ? [] : [item];
  return items.filter(
    (i) => i.seriesId === item.seriesId && i.date >= item.date && !i.postId,
  );
}

/** Items that can still become cards. */
export function convertible(items: PautaItem[]): PautaItem[] {
  return items.filter((i) => !i.postId);
}

/**
 * The card a pauta item becomes. The briefing and the caption travel into the
 * card's description, because that is where whoever produces it will look.
 */
export function toPostInput(item: PautaItem, calendarId: string): CreatePostInput {
  const parts = [item.caption?.trim(), item.briefing?.trim()].filter(Boolean);
  return {
    calendarId,
    title: item.title.trim(),
    date: item.date,
    description: parts.join("\n\n"),
    contentType: item.format?.trim() || (item.kind === "story" ? "story" : undefined),
    internalNotes: item.owner ? `Responsável: ${item.owner}` : undefined,
  };
}

/** Marks the item as produced, pointing at the card it became. */
export function markConverted(
  item: PautaItem,
  post: { id: string; calendarId: string },
  now = new Date().toISOString(),
): PautaItem {
  return {
    ...item,
    status: "convertida",
    postId: post.id,
    calendarId: post.calendarId,
    updatedAt: now,
  };
}

/** The card is gone: the plan goes back to being a plan. */
export function forgetCard(item: PautaItem, postId: string, now = new Date().toISOString()): PautaItem {
  if (item.postId !== postId) return item;
  return { ...item, status: "pronta", postId: undefined, calendarId: undefined, updatedAt: now };
}

export interface BalanceRow {
  id: string;
  label: string;
  /** What the plan asked for, in percent. */
  planned: number;
  /** What the pauta actually holds, in percent of the month's items. */
  actual: number;
  count: number;
  /** actual − planned, the number the panorama is really about. */
  gap: number;
}

function share(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

/**
 * Panorama de equilíbrio by pillar. Items with no pillar are reported as
 * their own row instead of being spread around: a pauta where half the posts
 * have no pillar is the finding, not something to average away.
 */
export function balanceByPillar(plan: MonthlyPlan, items: PautaItem[]): BalanceRow[] {
  const total = items.length;
  const rows = plan.pillars.map((p) => {
    const count = items.filter((i) => i.pillarId === p.id).length;
    const actual = share(count, total);
    return { id: p.id, label: p.name, planned: p.share, actual, count, gap: actual - p.share };
  });
  const known = new Set(plan.pillars.map((p) => p.id));
  const orphan = items.filter((i) => !i.pillarId || !known.has(i.pillarId)).length;
  if (orphan > 0) {
    const actual = share(orphan, total);
    rows.push({ id: "__sem__", label: "Sem pilar", planned: 0, actual, count: orphan, gap: actual });
  }
  return rows;
}

export function balanceByFunnel(plan: MonthlyPlan, items: PautaItem[]): BalanceRow[] {
  const total = items.length;
  const rows: BalanceRow[] = FUNNEL_STAGES.map((stage) => {
    const count = items.filter((i) => i.funnel === stage).length;
    const actual = share(count, total);
    const planned = plan.funnel[stage] ?? 0;
    return { id: stage, label: FUNNEL_LABEL[stage], planned, actual, count, gap: actual - planned };
  });
  const orphan = items.filter((i) => !i.funnel).length;
  if (orphan > 0) {
    const actual = share(orphan, total);
    rows.push({
      id: "__sem__",
      label: "Sem etapa",
      planned: 0,
      actual,
      count: orphan,
      gap: actual,
    });
  }
  return rows;
}

/**
 * Starts the month's plan. Pillars are copied from the previous month when
 * there is one — a brand's pillars rarely change, and retyping them is how
 * they end up different by accident.
 */
export function startPlan(
  clientId: string,
  month: string,
  previous?: MonthlyPlan,
  now = new Date().toISOString(),
  id: string = crypto.randomUUID(),
): MonthlyPlan {
  return {
    id,
    clientId,
    month,
    goals: (previous?.goals ?? []).map((g) => ({ ...g, previous: g.target, target: "" })),
    objectives: [],
    improvements: [],
    pillars: previous?.pillars?.map((p) => ({ ...p })) ?? [],
    funnel: previous ? { ...previous.funnel } : emptyFunnel(),
    actions: [],
    status: "rascunho",
    createdAt: now,
    updatedAt: now,
  };
}

/** The plan of one client for one month, when it exists. */
export function planFor(
  plans: MonthlyPlan[],
  clientId: string,
  month: string,
): MonthlyPlan | undefined {
  return plans.find((p) => p.clientId === clientId && p.month === month);
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
