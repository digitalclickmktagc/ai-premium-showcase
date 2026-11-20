import type {
  BriefingForm,
  FormAnswerValue,
  FormQuestion,
  FormQuestionKind,
  FormResponse,
} from "./types";
import { uid } from "./utils";

/**
 * Formulários de briefing (benchmark ficha 17, item F17b).
 *
 * The rules that matter here are about history, not about widgets:
 *
 *   • Editing a form never touches the answers already given.
 *   • Removing a question does not delete what people answered to it. The
 *     summary shows those answers under "pergunta removida" — a client
 *     answered it, and pretending they did not is a lie the agency tells
 *     itself.
 *   • A new link invalidates the old one, on purpose: that is what "new
 *     link" is for.
 */

export const QUESTION_KIND_LABEL: Record<FormQuestionKind, string> = {
  texto: "Texto",
  texto_longo: "Texto longo",
  estrelas: "Estrelas (1–5)",
  nota10: "Nota 0–10",
  simnao: "Sim ou não",
  lista: "Escolha uma",
  multipla: "Escolha várias",
  escala: "Escala",
  data: "Data",
};

/** Kinds whose answers are numbers, and so can be averaged. */
const NUMERIC: FormQuestionKind[] = ["estrelas", "nota10", "escala"];

/** Kinds that need a list of options to make sense. */
const WITH_OPTIONS: FormQuestionKind[] = ["lista", "multipla"];

export function newQuestion(kind: FormQuestionKind = "texto"): FormQuestion {
  return {
    id: uid("q"),
    kind,
    label: "",
    required: false,
    options: WITH_OPTIONS.includes(kind) ? ["", ""] : undefined,
    scaleMin: kind === "escala" ? 1 : undefined,
    scaleMax: kind === "escala" ? 5 : undefined,
  };
}

export function validateForm(form: BriefingForm): string | null {
  if (!form.title.trim()) return "Dê um título ao formulário.";
  if (form.questions.length === 0) return "Um formulário sem pergunta não pergunta nada.";
  for (const q of form.questions) {
    if (!q.label.trim()) return "Toda pergunta precisa de enunciado.";
    if (WITH_OPTIONS.includes(q.kind)) {
      const options = (q.options ?? []).filter((o) => o.trim());
      if (options.length < 2) return `"${q.label}" precisa de ao menos duas opções.`;
    }
    if (q.kind === "escala") {
      const min = q.scaleMin ?? 1;
      const max = q.scaleMax ?? 5;
      if (max <= min) return `Na escala de "${q.label}", o fim precisa ser maior que o começo.`;
      if (max - min > 10) return `A escala de "${q.label}" é longa demais para responder.`;
    }
  }
  return null;
}

/** The numbers a question of each kind accepts. */
export function rangeOf(question: FormQuestion): { min: number; max: number } | null {
  if (question.kind === "estrelas") return { min: 1, max: 5 };
  if (question.kind === "nota10") return { min: 0, max: 10 };
  if (question.kind === "escala")
    return { min: question.scaleMin ?? 1, max: question.scaleMax ?? 5 };
  return null;
}

export function isAnswered(value: FormAnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** What is wrong with an attempted answer, question by question. */
export function validateAnswers(
  form: BriefingForm,
  answers: Record<string, FormAnswerValue>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of form.questions) {
    const value = answers[q.id];
    if (q.required && !isAnswered(value)) {
      errors[q.id] = "Esta pergunta é obrigatória.";
      continue;
    }
    if (!isAnswered(value)) continue;

    const range = rangeOf(q);
    if (range) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < range.min || n > range.max)
        errors[q.id] = `Responda de ${range.min} a ${range.max}.`;
    }
    if (q.kind === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(String(value)))
      errors[q.id] = "Data inválida.";
    if (q.kind === "lista" && !(q.options ?? []).includes(String(value)))
      errors[q.id] = "Escolha uma das opções.";
    if (q.kind === "multipla") {
      const chosen = Array.isArray(value) ? value : [String(value)];
      if (chosen.some((c) => !(q.options ?? []).includes(c)))
        errors[q.id] = "Escolha apenas entre as opções.";
    }
  }
  return errors;
}

export function buildResponse(
  formId: string,
  answers: Record<string, FormAnswerValue>,
  respondent?: string,
  now = new Date().toISOString(),
  id: string = uid("resp"),
): FormResponse {
  return { id, formId, answers, respondent: respondent?.trim() || undefined, at: now };
}

// ── Resumo ───────────────────────────────────────────────────

export interface NumericSummary {
  kind: "numero";
  count: number;
  average: number;
  min: number;
  max: number;
  /** Net promoter score, only for a 0–10 question. */
  nps?: { promoters: number; passives: number; detractors: number; score: number };
}

export interface ChoiceSummary {
  kind: "escolha";
  count: number;
  options: { label: string; count: number; share: number }[];
}

export interface TextSummary {
  kind: "texto";
  count: number;
  answers: { at: string; respondent?: string; value: string }[];
}

export type QuestionSummary = (NumericSummary | ChoiceSummary | TextSummary) & {
  questionId: string;
  label: string;
  /** True when the question is no longer in the form but was answered. */
  removed?: boolean;
};

function npsOf(values: number[]) {
  const promoters = values.filter((v) => v >= 9).length;
  const detractors = values.filter((v) => v <= 6).length;
  const passives = values.length - promoters - detractors;
  return {
    promoters,
    passives,
    detractors,
    // The standard formula: %promoters − %detractors, rounded to a whole.
    score: Math.round(((promoters - detractors) / values.length) * 100),
  };
}

function summariseQuestion(
  question: FormQuestion,
  responses: FormResponse[],
): QuestionSummary {
  const given = responses
    .map((r) => ({ response: r, value: r.answers[question.id] }))
    .filter((a) => isAnswered(a.value));

  if (NUMERIC.includes(question.kind)) {
    const values = given.map((a) => Number(a.value)).filter((n) => Number.isFinite(n));
    const summary: QuestionSummary = {
      questionId: question.id,
      label: question.label,
      kind: "numero",
      count: values.length,
      average:
        values.length === 0
          ? 0
          : Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100,
      min: values.length === 0 ? 0 : Math.min(...values),
      max: values.length === 0 ? 0 : Math.max(...values),
    };
    if (question.kind === "nota10" && values.length > 0) {
      (summary as NumericSummary).nps = npsOf(values);
    }
    return summary;
  }

  if (WITH_OPTIONS.includes(question.kind) || question.kind === "simnao") {
    const options =
      question.kind === "simnao" ? ["Sim", "Não"] : (question.options ?? []).filter((o) => o.trim());
    const counts = new Map(options.map((o) => [o, 0]));
    let total = 0;
    for (const { value } of given) {
      const chosen = Array.isArray(value) ? value : [String(value)];
      for (const c of chosen) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
        total += 1;
      }
    }
    return {
      questionId: question.id,
      label: question.label,
      kind: "escolha",
      count: given.length,
      options: [...counts.entries()].map(([label, count]) => ({
        label,
        count,
        share: total === 0 ? 0 : Math.round((count / total) * 100),
      })),
    };
  }

  return {
    questionId: question.id,
    label: question.label,
    kind: "texto",
    count: given.length,
    answers: given.map(({ response, value }) => ({
      at: response.at,
      respondent: response.respondent,
      value: String(value),
    })),
  };
}

/**
 * The form's answers, question by question — including questions that were
 * removed from the form but that people had already answered.
 */
export function summariseForm(
  form: BriefingForm,
  responses: FormResponse[],
): QuestionSummary[] {
  const own = responses.filter((r) => r.formId === form.id);
  const live = form.questions.map((q) => summariseQuestion(q, own));

  const known = new Set(form.questions.map((q) => q.id));
  const orphanIds = new Set<string>();
  for (const response of own) {
    for (const [questionId, value] of Object.entries(response.answers)) {
      if (!known.has(questionId) && isAnswered(value)) orphanIds.add(questionId);
    }
  }

  const orphans = [...orphanIds].map((id) => ({
    ...summariseQuestion({ id, kind: "texto", label: "Pergunta removida", required: false }, own),
    removed: true,
  }));

  return [...live, ...orphans];
}

/** Only an active form answers its link. A paused one looks like nothing. */
export function isOpen(form: BriefingForm): boolean {
  return form.status === "ativo";
}
