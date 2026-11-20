import type {
  FinanceEntry,
  HealthWeights,
  Post,
  Project,
  ProjectStatus,
  Squad,
} from "./types";
import { todayISO } from "./utils";

/**
 * Projetos e squads (benchmark ficha 14).
 *
 * The ficha's critique is that the progress and health numbers are never
 * explained to the person reading them. So both formulas live here, in the
 * open, the weights are data the agency edits, and the screen prints the
 * arithmetic beside the number. A score nobody can explain is a score nobody
 * should act on.
 *
 * The project is also the cost centre: finance entries point at it, so
 * "this project made money" is a question the system can answer instead of
 * a feeling someone has.
 */

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

/** A project stops counting as work once it is concluded or cancelled. */
export function isOpen(project: Project): boolean {
  return project.status === "ativo" || project.status === "pausado";
}

export function validateProject(project: Project): string | null {
  if (!project.name.trim()) return "Dê um nome ao projeto.";
  if (!project.clientId) return "O projeto é de um cliente.";
  if (project.value < 0) return "O valor não pode ser negativo.";
  if (project.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(project.dueDate))
    return "Prazo inválido.";
  return null;
}

export function validateSquad(squad: Squad): string | null {
  if (!squad.name.trim()) return "Dê um nome ao squad.";
  const names = squad.members.map((m) => m.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) return "Há nomes repetidos no squad.";
  return null;
}

export interface Progress {
  done: number;
  total: number;
  /** null when the project has no card yet: 0% would be a lie. */
  percent: number | null;
}

/** Cards of a project, deleted ones excluded. */
export function projectPosts(posts: Post[], projectId: string): Post[] {
  return posts.filter((p) => p.projectId === projectId && p.status !== "deleted");
}

/**
 * Progress = cards concluded ÷ cards of the project.
 *
 * "Concluded" means published or done — the two statuses that mean the work
 * left the agency. The formula is stated on the screen next to the bar.
 */
export function projectProgress(project: Project, posts: Post[]): Progress {
  const own = projectPosts(posts, project.id);
  const done = own.filter((p) => p.status === "published" || p.status === "done").length;
  return {
    done,
    total: own.length,
    percent: own.length === 0 ? null : Math.round((done / own.length) * 100),
  };
}

/** Late = past its deadline and still open. A concluded project is not late. */
export function isLate(project: Project, today = todayISO()): boolean {
  return isOpen(project) && !!project.dueDate && project.dueDate < today;
}

export function lateCount(projects: Project[], today = todayISO()): number {
  return projects.filter((p) => isLate(p, today)).length;
}

export interface ProjectResult {
  /** Integer cents. */
  revenue: number;
  cost: number;
  balance: number;
  /** Margin over revenue, in percent; null when nothing came in. */
  margin: number | null;
}

/**
 * What a project made. Only settled entries count: a forecast is a wish,
 * and reporting margin on wishes is how an agency talks itself into a loss.
 */
export function projectResult(entries: FinanceEntry[], projectId: string): ProjectResult {
  const own = entries.filter((e) => e.projectId === projectId && e.status === "liquidado");
  const revenue = own.filter((e) => e.nature === "receita").reduce((s, e) => s + e.amount, 0);
  const cost = own.filter((e) => e.nature === "despesa").reduce((s, e) => s + e.amount, 0);
  const balance = revenue - cost;
  return {
    revenue,
    cost,
    balance,
    margin: revenue === 0 ? null : Math.round((balance / revenue) * 100),
  };
}

export function squadProjects(projects: Project[], squadId: string): Project[] {
  return projects.filter((p) => p.squadId === squadId);
}

/**
 * The clients a squad serves — derived from its projects, never typed twice.
 * Assigning a project to a squad is what puts its client in the squad, which
 * is the rule the ficha documents.
 */
export function squadClients(projects: Project[], squadId: string): string[] {
  return [...new Set(squadProjects(projects, squadId).map((p) => p.clientId))];
}

export const DEFAULT_HEALTH_WEIGHTS: HealthWeights = {
  prazo: 40,
  progresso: 40,
  entrega: 20,
};

export const HEALTH_LABEL: Record<keyof HealthWeights, string> = {
  prazo: "Projetos no prazo",
  progresso: "Progresso médio",
  entrega: "Cards entregues",
};

export interface HealthPart {
  key: keyof HealthWeights;
  label: string;
  /** The component's own percentage, 0–100, or null when there is no base. */
  value: number | null;
  weight: number;
  /** value × weight ÷ 100, the points this component contributes. */
  points: number;
  /** Plain-language arithmetic, printed beside the number. */
  detail: string;
}

export interface Health {
  /** 0–100, or null when nothing can be measured yet. */
  score: number | null;
  parts: HealthPart[];
}

/**
 * Squad health, spelled out.
 *
 * Three components, each a percentage, combined with the agency's weights:
 *   • prazo     — open projects that are not past their deadline
 *   • progresso — average progress of its projects that have cards
 *   • entrega   — cards of those projects that are published or done
 *
 * A component with no base (no projects, no cards) is left out and its
 * weight is redistributed, instead of counting as zero and punishing a squad
 * for work it has not started.
 */
export function squadHealth(
  squadId: string,
  projects: Project[],
  posts: Post[],
  weights: HealthWeights = DEFAULT_HEALTH_WEIGHTS,
  today = todayISO(),
): Health {
  const own = squadProjects(projects, squadId);
  const open = own.filter(isOpen);
  const onTime = open.filter((p) => !isLate(p, today)).length;

  const progresses = own
    .map((p) => projectProgress(p, posts))
    .filter((pr) => pr.total > 0);
  const avgProgress =
    progresses.length === 0
      ? null
      : Math.round(progresses.reduce((s, pr) => s + (pr.percent ?? 0), 0) / progresses.length);

  const cards = own.flatMap((p) => projectPosts(posts, p.id));
  const delivered = cards.filter((c) => c.status === "published" || c.status === "done").length;

  const raw: { key: keyof HealthWeights; value: number | null; detail: string }[] = [
    {
      key: "prazo",
      value: open.length === 0 ? null : Math.round((onTime / open.length) * 100),
      detail:
        open.length === 0
          ? "sem projeto aberto"
          : `${onTime} de ${open.length} projeto(s) aberto(s) dentro do prazo`,
    },
    {
      key: "progresso",
      value: avgProgress,
      detail:
        progresses.length === 0
          ? "nenhum projeto com card"
          : `média de ${progresses.length} projeto(s) com card`,
    },
    {
      key: "entrega",
      value: cards.length === 0 ? null : Math.round((delivered / cards.length) * 100),
      detail:
        cards.length === 0
          ? "nenhum card nos projetos"
          : `${delivered} de ${cards.length} card(s) publicados ou feitos`,
    },
  ];

  const usable = raw.filter((r) => r.value !== null);
  const totalWeight = usable.reduce((s, r) => s + weights[r.key], 0);

  const parts: HealthPart[] = raw.map((r) => {
    // The weight is normalised over the components that can be measured, so
    // the score always reads out of 100 and never hides a missing component.
    const weight =
      r.value === null || totalWeight === 0
        ? weights[r.key]
        : Math.round((weights[r.key] / totalWeight) * 100);
    return {
      key: r.key,
      label: HEALTH_LABEL[r.key],
      value: r.value,
      weight,
      points: r.value === null ? 0 : Math.round((r.value * weight) / 100),
      detail: r.detail,
    };
  });

  const score =
    usable.length === 0 ? null : Math.min(100, parts.reduce((s, p) => s + p.points, 0));
  return { score, parts };
}

export function validateWeights(weights: HealthWeights): string | null {
  const total = weights.prazo + weights.progresso + weights.entrega;
  if (total !== 100) return `Os pesos precisam somar 100 (somam ${total}).`;
  if (Object.values(weights).some((w) => w < 0)) return "Peso não pode ser negativo.";
  return null;
}

/** The project the saga opens when a contract comes into force. */
export function projectFromContract(
  clientId: string,
  contractId: string,
  name: string,
  value: number,
  now = new Date().toISOString(),
  id: string = crypto.randomUUID(),
): Project {
  return {
    id,
    name,
    clientId,
    contractId,
    value,
    status: "ativo",
    createdAt: now,
    updatedAt: now,
  };
}
