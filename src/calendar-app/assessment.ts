import type {
  Assessment,
  AssessmentBand,
  AssessmentQuestion,
  AssessmentSubject,
  AssessmentTemplate,
} from "./types";
import { uid } from "./utils";

/**
 * Análise de perfil e de concorrência (benchmark ficha 17, item F17d).
 *
 * The ficha praises one thing about the original — questions and weights as
 * data the agency edits — and leaves two problems: the bands that turn a
 * score into a verdict are undocumented, and the analysis lives apart from
 * the client's strategy. Both are addressed here: the bands are editable and
 * printed beside the number, and a finished analysis can be written into the
 * dossier's sections instead of becoming a second, divergent truth.
 *
 * The score is a weighted average of 0–5 ratings, normalised to 0–100. The
 * screen shows that sentence; a verdict nobody can derive is a verdict
 * nobody should repeat to a client.
 */

export const MAX_COMPETITORS = 3;

export function defaultQuestions(): AssessmentQuestion[] {
  return [
    { id: "bio", group: "Perfil", label: "A bio diz o que a marca faz e para quem", weight: 2 },
    { id: "destaques", group: "Perfil", label: "Destaques organizados e atualizados", weight: 1 },
    { id: "identidade", group: "Perfil", label: "Identidade visual reconhecível na grade", weight: 2 },
    { id: "frequencia", group: "Conteúdo", label: "Frequência de publicação constante", weight: 2 },
    { id: "formatos", group: "Conteúdo", label: "Variedade de formatos (feed, reels, stories)", weight: 2 },
    { id: "pilares", group: "Conteúdo", label: "Equilíbrio entre educar, vender e aproximar", weight: 2 },
    { id: "legendas", group: "Conteúdo", label: "Legendas com chamada clara", weight: 1 },
    { id: "engajamento", group: "Orgânico", label: "Engajamento proporcional ao tamanho", weight: 3 },
    { id: "comentarios", group: "Orgânico", label: "Comentários respondidos", weight: 1 },
    { id: "anuncios", group: "Anúncios", label: "Anúncios no ar e coerentes com o orgânico", weight: 2 },
    { id: "reputacao", group: "Reputação", label: "Avaliações e respostas públicas", weight: 2 },
  ];
}

/** Five bands, as the ficha asks — and editable, as its critique asks. */
export function defaultBands(): AssessmentBand[] {
  return [
    { min: 85, label: "Referência" },
    { min: 70, label: "Forte" },
    { min: 50, label: "Mediano" },
    { min: 30, label: "Frágil" },
    { min: 0, label: "Crítico" },
  ];
}

export function defaultTemplate(
  now = new Date().toISOString(),
  id: string = uid("tplan"),
): AssessmentTemplate {
  return {
    id,
    name: "Análise padrão",
    questions: defaultQuestions(),
    bands: defaultBands(),
    createdAt: now,
    updatedAt: now,
  };
}

export function newQuestion(group = "Perfil"): AssessmentQuestion {
  return { id: uid("aq"), group, label: "", weight: 1 };
}

export function validateTemplate(template: AssessmentTemplate): string | null {
  if (!template.name.trim()) return "Dê um nome ao modelo de análise.";
  if (template.questions.length === 0) return "Uma análise sem critério não analisa nada.";
  if (template.questions.some((q) => !q.label.trim())) return "Todo critério precisa de enunciado.";
  if (template.questions.some((q) => q.weight <= 0)) return "Peso precisa ser maior que zero.";
  const ids = template.questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) return "Há critérios com o mesmo identificador.";
  if (template.bands.length === 0) return "Defina ao menos uma faixa.";
  if (template.bands.some((b) => b.min < 0 || b.min > 100)) return "Faixa vai de 0 a 100.";
  if (!template.bands.some((b) => b.min === 0))
    return "A faixa mais baixa precisa começar em 0, senão uma nota fica sem veredito.";
  return null;
}

export function newSubject(name = "", kind: AssessmentSubject["kind"] = "concorrente"): AssessmentSubject {
  return { id: uid("subj"), name, kind };
}

export function startAssessment(
  clientId: string,
  clientName: string,
  templateId: string,
  now = new Date().toISOString(),
  id: string = uid("anal"),
): Assessment {
  return {
    id,
    clientId,
    templateId,
    title: `Análise de ${clientName}`,
    subjects: [{ ...newSubject(clientName, "cliente"), id: uid("subj") }],
    scores: {},
    status: "em_andamento",
    createdAt: now,
    updatedAt: now,
  };
}

export function competitors(assessment: Assessment): AssessmentSubject[] {
  return assessment.subjects.filter((s) => s.kind === "concorrente");
}

export function canAddCompetitor(assessment: Assessment): boolean {
  return competitors(assessment).length < MAX_COMPETITORS;
}

export function validateAssessment(assessment: Assessment): string | null {
  if (!assessment.title.trim()) return "Dê um nome à análise.";
  if (competitors(assessment).length > MAX_COMPETITORS)
    return `A comparação vai até ${MAX_COMPETITORS} concorrentes — mais do que isso ninguém lê.`;
  if (assessment.subjects.some((s) => !s.name.trim())) return "Todo perfil comparado precisa de nome.";
  for (const ratings of Object.values(assessment.scores)) {
    if (Object.values(ratings).some((r) => r < 0 || r > 5)) return "As notas vão de 0 a 5.";
  }
  return null;
}

export interface GroupScore {
  group: string;
  /** 0–100, or null when nothing in the group was rated. */
  score: number | null;
  answered: number;
  total: number;
}

export interface SubjectScore {
  subjectId: string;
  name: string;
  kind: AssessmentSubject["kind"];
  /** 0–100, or null when nothing was rated at all. */
  score: number | null;
  band: string | null;
  groups: GroupScore[];
  answered: number;
  total: number;
}

function weightedScore(
  questions: AssessmentQuestion[],
  ratings: Record<string, number>,
): { score: number | null; answered: number } {
  let sum = 0;
  let weight = 0;
  let answered = 0;
  for (const q of questions) {
    const rating = ratings[q.id];
    if (rating === undefined || rating === null) continue;
    sum += rating * q.weight;
    weight += q.weight;
    answered += 1;
  }
  // A question nobody rated is left out of the average rather than counted
  // as zero: not having looked is not the same as being bad.
  return { score: weight === 0 ? null : Math.round((sum / (weight * 5)) * 100), answered };
}

export function bandOf(score: number | null, bands: AssessmentBand[]): string | null {
  if (score === null) return null;
  return [...bands].sort((a, b) => b.min - a.min).find((b) => score >= b.min)?.label ?? null;
}

export function scoreSubject(
  assessment: Assessment,
  subject: AssessmentSubject,
  template: AssessmentTemplate,
): SubjectScore {
  const ratings = assessment.scores[subject.id] ?? {};
  const overall = weightedScore(template.questions, ratings);
  const groups = [...new Set(template.questions.map((q) => q.group))].map((group) => {
    const questions = template.questions.filter((q) => q.group === group);
    const partial = weightedScore(questions, ratings);
    return {
      group,
      score: partial.score,
      answered: partial.answered,
      total: questions.length,
    };
  });
  return {
    subjectId: subject.id,
    name: subject.name,
    kind: subject.kind,
    score: overall.score,
    band: bandOf(overall.score, template.bands),
    groups,
    answered: overall.answered,
    total: template.questions.length,
  };
}

export function scoreAll(
  assessment: Assessment,
  template: AssessmentTemplate,
): SubjectScore[] {
  return assessment.subjects.map((s) => scoreSubject(assessment, s, template));
}

export interface Gap {
  group: string;
  /** The client's score in this group. */
  ours: number;
  /** The best competitor's score in this group. */
  theirs: number;
  /** theirs − ours, positive when we are behind. */
  behind: number;
  leader: string;
}

/**
 * Where the client loses, by group, against the best competitor in each.
 * Only groups both sides actually rated are compared — a gap against an
 * unrated group is arithmetic, not a finding.
 */
export function gaps(assessment: Assessment, template: AssessmentTemplate): Gap[] {
  const all = scoreAll(assessment, template);
  const ours = all.find((s) => s.kind === "cliente");
  const rivals = all.filter((s) => s.kind === "concorrente");
  if (!ours || rivals.length === 0) return [];

  const out: Gap[] = [];
  for (const group of ours.groups) {
    if (group.score === null) continue;
    const best = rivals
      .map((r) => ({ name: r.name, score: r.groups.find((g) => g.group === group.group)?.score }))
      .filter((r): r is { name: string; score: number } => r.score !== null && r.score !== undefined)
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    out.push({
      group: group.group,
      ours: group.score,
      theirs: best.score,
      behind: best.score - group.score,
      leader: best.name,
    });
  }
  return out.sort((a, b) => b.behind - a.behind);
}

/** A concluded analysis is frozen until someone reopens it on purpose. */
export function canEdit(assessment: Assessment): boolean {
  return assessment.status !== "concluida";
}

/**
 * The text this analysis contributes to the dossier's raio-X section, so the
 * strategy and the analysis stay one truth instead of two.
 */
export function toDossierText(
  assessment: Assessment,
  template: AssessmentTemplate,
): string {
  const all = scoreAll(assessment, template);
  const ours = all.find((s) => s.kind === "cliente");
  if (!ours) return "";
  const lines = [
    `${ours.name}: ${ours.score === null ? "sem nota" : `${ours.score}/100`}${
      ours.band ? ` (${ours.band})` : ""
    } — ${ours.answered} de ${ours.total} critérios avaliados.`,
  ];
  for (const group of ours.groups) {
    if (group.score === null) continue;
    lines.push(`• ${group.group}: ${group.score}/100`);
  }
  const behind = gaps(assessment, template).filter((g) => g.behind > 0);
  if (behind.length > 0) {
    lines.push("");
    lines.push("Onde perdemos hoje:");
    for (const gap of behind) {
      lines.push(`• ${gap.group}: ${gap.ours} contra ${gap.theirs} de ${gap.leader}.`);
    }
  }
  if (assessment.conclusions?.trim()) {
    lines.push("");
    lines.push(assessment.conclusions.trim());
  }
  return lines.join("\n");
}

/** The competitor rows for the dossier's table section. */
export function toDossierRows(assessment: Assessment): Record<string, string>[] {
  return competitors(assessment).map((s) => ({
    nome: s.name,
    perfil: s.handle ?? "",
    seguidores: s.followers ? String(s.followers) : "",
    frequencia: s.frequency ?? "",
    tipo: s.notes ?? "",
  }));
}
