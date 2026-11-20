import { describe, expect, it } from "vitest";
import {
  buildResponse,
  isOpen,
  newQuestion,
  rangeOf,
  summariseForm,
  validateAnswers,
  validateForm,
} from "./forms";
import type { BriefingForm, FormQuestion, FormResponse } from "./types";

const NOW = "2026-08-01T10:00:00.000Z";

function question(over: Partial<FormQuestion> = {}): FormQuestion {
  return { id: "q1", kind: "texto", label: "Qual o objetivo?", required: false, ...over };
}

function form(questions: FormQuestion[], over: Partial<BriefingForm> = {}): BriefingForm {
  return {
    id: "f1",
    title: "Briefing de campanha",
    questions,
    status: "ativo",
    shareToken: "tok",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function response(answers: Record<string, string | string[] | number>, over: Partial<FormResponse> = {}): FormResponse {
  return { id: "r1", formId: "f1", answers, at: NOW, ...over };
}

describe("validateForm", () => {
  it("demands a title and at least one question", () => {
    expect(validateForm(form([question()], { title: " " }))).toMatch(/título/);
    expect(validateForm(form([]))).toMatch(/sem pergunta/);
  });

  it("demands an enunciado on every question", () => {
    expect(validateForm(form([question({ label: "" })]))).toMatch(/enunciado/);
  });

  it("demands two real options for a choice question", () => {
    const one = question({ kind: "lista", label: "Tom", options: ["Formal", "  "] });
    expect(validateForm(form([one]))).toMatch(/duas opções/);
    expect(validateForm(form([{ ...one, options: ["Formal", "Informal"] }]))).toBeNull();
  });

  it("refuses a scale that goes nowhere or goes too far", () => {
    const base = question({ kind: "escala", label: "Urgência" });
    expect(validateForm(form([{ ...base, scaleMin: 5, scaleMax: 5 }]))).toMatch(/maior/);
    expect(validateForm(form([{ ...base, scaleMin: 0, scaleMax: 50 }]))).toMatch(/longa demais/);
    expect(validateForm(form([{ ...base, scaleMin: 1, scaleMax: 7 }]))).toBeNull();
  });

  it("gives a new choice question two blank options to fill", () => {
    expect(newQuestion("lista").options).toHaveLength(2);
    expect(newQuestion("texto").options).toBeUndefined();
    expect(newQuestion("escala")).toMatchObject({ scaleMin: 1, scaleMax: 5 });
  });

  it("knows the range of each kind", () => {
    expect(rangeOf(question({ kind: "estrelas" }))).toEqual({ min: 1, max: 5 });
    expect(rangeOf(question({ kind: "nota10" }))).toEqual({ min: 0, max: 10 });
    expect(rangeOf(question({ kind: "texto" }))).toBeNull();
  });
});

describe("validateAnswers", () => {
  const f = form([
    question({ id: "obrig", required: true, label: "Objetivo" }),
    question({ id: "nota", kind: "nota10", label: "Recomendaria?" }),
    question({ id: "tom", kind: "lista", label: "Tom", options: ["Formal", "Informal"] }),
    question({ id: "canais", kind: "multipla", label: "Canais", options: ["IG", "TikTok"] }),
    question({ id: "quando", kind: "data", label: "Quando" }),
  ]);

  it("accepts a complete answer", () => {
    expect(
      validateAnswers(f, {
        obrig: "Vender mais",
        nota: 9,
        tom: "Formal",
        canais: ["IG"],
        quando: "2026-09-01",
      }),
    ).toEqual({});
  });

  it("demands the required ones, and only those", () => {
    expect(validateAnswers(f, {})).toEqual({ obrig: "Esta pergunta é obrigatória." });
    expect(validateAnswers(f, { obrig: "   " }).obrig).toBeDefined();
  });

  it("keeps a number inside its range", () => {
    expect(validateAnswers(f, { obrig: "x", nota: 11 }).nota).toMatch(/de 0 a 10/);
    expect(validateAnswers(f, { obrig: "x", nota: 0 }).nota).toBeUndefined();
  });

  it("refuses an option nobody offered", () => {
    expect(validateAnswers(f, { obrig: "x", tom: "Sarcástico" }).tom).toBeDefined();
    expect(validateAnswers(f, { obrig: "x", canais: ["IG", "Orkut"] }).canais).toBeDefined();
  });

  it("refuses a date that is not one", () => {
    expect(validateAnswers(f, { obrig: "x", quando: "amanhã" }).quando).toMatch(/Data/);
  });
});

describe("summariseForm", () => {
  const f = form([
    question({ id: "nota", kind: "nota10", label: "Recomendaria?" }),
    question({ id: "estrelas", kind: "estrelas", label: "Atendimento" }),
    question({ id: "tom", kind: "lista", label: "Tom", options: ["Formal", "Informal"] }),
    question({ id: "obj", kind: "texto", label: "Objetivo" }),
  ]);

  const responses = [
    response({ nota: 10, estrelas: 5, tom: "Formal", obj: "Vender" }, { id: "a" }),
    response({ nota: 9, estrelas: 4, tom: "Informal", obj: "Crescer" }, { id: "b" }),
    response({ nota: 5, estrelas: 3, tom: "Formal" }, { id: "c" }),
  ];

  it("averages the numbers and reports the extremes", () => {
    const nota = summariseForm(f, responses).find((s) => s.questionId === "nota")!;
    expect(nota).toMatchObject({ kind: "numero", count: 3, average: 8, min: 5, max: 10 });
  });

  it("computes NPS on a 0–10 question, by the standard formula", () => {
    const nota = summariseForm(f, responses).find((s) => s.questionId === "nota")!;
    expect(nota.kind === "numero" && nota.nps).toMatchObject({
      promoters: 2,
      passives: 0,
      detractors: 1,
      score: 33,
    });
  });

  it("does not compute NPS on a question that is not 0–10", () => {
    const stars = summariseForm(f, responses).find((s) => s.questionId === "estrelas")!;
    expect(stars.kind === "numero" && stars.nps).toBeUndefined();
  });

  it("counts choices and their share", () => {
    const tom = summariseForm(f, responses).find((s) => s.questionId === "tom")!;
    expect(tom.kind === "escolha" && tom.options).toEqual([
      { label: "Formal", count: 2, share: 67 },
      { label: "Informal", count: 1, share: 33 },
    ]);
  });

  it("lists text answers with who said them and when", () => {
    const obj = summariseForm(f, responses).find((s) => s.questionId === "obj")!;
    expect(obj.kind === "texto" && obj.count).toBe(2);
    expect(obj.kind === "texto" && obj.answers.map((a) => a.value)).toEqual(["Vender", "Crescer"]);
  });

  it("keeps the answers of a question that was removed from the form", () => {
    const shorter = form([question({ id: "obj", kind: "texto", label: "Objetivo" })]);
    const out = summariseForm(shorter, responses);
    const removed = out.filter((s) => s.removed);
    expect(removed.map((s) => s.questionId).sort()).toEqual(["estrelas", "nota", "tom"]);
    expect(removed[0].label).toBe("Pergunta removida");
  });

  it("ignores another form's responses", () => {
    const foreign = response({ nota: 1 }, { id: "x", formId: "outro" });
    const nota = summariseForm(f, [...responses, foreign]).find((s) => s.questionId === "nota")!;
    expect(nota.count).toBe(3);
  });

  it("does not divide by zero with no response at all", () => {
    const empty = summariseForm(f, []);
    expect(empty.every((s) => s.count === 0)).toBe(true);
  });
});

describe("state", () => {
  it("only an active form answers its link", () => {
    expect(isOpen(form([question()]))).toBe(true);
    expect(isOpen(form([question()], { status: "pausado" }))).toBe(false);
  });

  it("builds a response with the moment it arrived", () => {
    const r = buildResponse("f1", { q1: "x" }, "  Ana  ", NOW, "r9");
    expect(r).toEqual({ id: "r9", formId: "f1", answers: { q1: "x" }, respondent: "Ana", at: NOW });
  });
});
