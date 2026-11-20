import { describe, expect, it } from "vitest";
import {
  MAX_COMPETITORS,
  bandOf,
  canAddCompetitor,
  canEdit,
  competitors,
  defaultBands,
  defaultTemplate,
  gaps,
  newQuestion,
  newSubject,
  scoreAll,
  scoreSubject,
  startAssessment,
  toDossierRows,
  toDossierText,
  validateAssessment,
  validateTemplate,
} from "./assessment";
import type { Assessment, AssessmentSubject, AssessmentTemplate } from "./types";

const NOW = "2026-11-01T10:00:00.000Z";

function template(over: Partial<AssessmentTemplate> = {}): AssessmentTemplate {
  return {
    id: "t1",
    name: "Modelo",
    questions: [
      { id: "a", group: "Perfil", label: "Bio clara", weight: 2 },
      { id: "b", group: "Perfil", label: "Destaques", weight: 1 },
      { id: "c", group: "Conteúdo", label: "Frequência", weight: 1 },
    ],
    bands: defaultBands(),
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function assessment(over: Partial<Assessment> = {}): Assessment {
  return {
    id: "a1",
    clientId: "c1",
    templateId: "t1",
    title: "Análise de Aurora",
    subjects: [
      { id: "nos", name: "Aurora", kind: "cliente" },
      { id: "r1", name: "Concorrente A", kind: "concorrente" },
    ],
    scores: {},
    status: "em_andamento",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe("default template", () => {
  it("comes with criteria, weights and five bands", () => {
    const t = defaultTemplate(NOW, "t1");
    expect(t.questions.length).toBeGreaterThan(8);
    expect(t.bands).toHaveLength(5);
    expect(validateTemplate(t)).toBeNull();
  });

  it("has a band that starts at zero, so no score is left without a verdict", () => {
    expect(defaultBands().some((b) => b.min === 0)).toBe(true);
    expect(validateTemplate(template({ bands: [{ min: 50, label: "Bom" }] }))).toMatch(/começar em 0/);
  });
});

describe("validateTemplate", () => {
  it("demands a name, criteria, enunciados and positive weights", () => {
    expect(validateTemplate(template({ name: " " }))).toMatch(/nome/);
    expect(validateTemplate(template({ questions: [] }))).toMatch(/sem critério/);
    expect(validateTemplate(template({ questions: [newQuestion()] }))).toMatch(/enunciado/);
    expect(
      validateTemplate(template({ questions: [{ id: "a", group: "g", label: "x", weight: 0 }] })),
    ).toMatch(/maior que zero/);
  });

  it("refuses two criteria with the same id", () => {
    const q = { id: "a", group: "g", label: "x", weight: 1 };
    expect(validateTemplate(template({ questions: [q, { ...q }] }))).toMatch(/mesmo identificador/);
  });
});

describe("subjects", () => {
  it("starts with the client as the first subject", () => {
    const a = startAssessment("c1", "Aurora", "t1", NOW, "a1");
    expect(a.subjects).toHaveLength(1);
    expect(a.subjects[0]).toMatchObject({ name: "Aurora", kind: "cliente" });
    expect(a.status).toBe("em_andamento");
  });

  it("compares up to three competitors and says why", () => {
    const three = Array.from({ length: 3 }, (_, i) => newSubject(`C${i}`));
    const full = assessment({ subjects: [{ id: "nos", name: "Aurora", kind: "cliente" }, ...three] });
    expect(competitors(full)).toHaveLength(MAX_COMPETITORS);
    expect(canAddCompetitor(full)).toBe(false);
    const over = assessment({
      subjects: [...full.subjects, newSubject("C4") as AssessmentSubject],
    });
    expect(validateAssessment(over)).toMatch(/até 3 concorrentes/);
  });

  it("demands a name for every subject and ratings inside 0–5", () => {
    expect(validateAssessment(assessment({ subjects: [newSubject("  ")] }))).toMatch(/nome/);
    expect(validateAssessment(assessment({ scores: { nos: { a: 7 } } }))).toMatch(/0 a 5/);
    expect(validateAssessment(assessment({ scores: { nos: { a: 5 } } }))).toBeNull();
  });
});

describe("scoring", () => {
  const t = template();

  it("is a weighted average of the ratings, on a 0–100 scale", () => {
    // a=5 (peso 2), b=0 (peso 1), c=5 (peso 1) → (10+0+5) / (4*5) = 75
    const a = assessment({ scores: { nos: { a: 5, b: 0, c: 5 } } });
    const score = scoreSubject(a, a.subjects[0], t);
    expect(score.score).toBe(75);
    expect(score.band).toBe("Forte");
    expect(score.answered).toBe(3);
  });

  it("leaves an unrated criterion out instead of counting it as zero", () => {
    const a = assessment({ scores: { nos: { a: 5 } } });
    const score = scoreSubject(a, a.subjects[0], t);
    expect(score.score).toBe(100);
    expect(score.answered).toBe(1);
    expect(score.total).toBe(3);
  });

  it("has no score at all when nothing was rated", () => {
    const score = scoreSubject(assessment(), assessment().subjects[0], t);
    expect(score.score).toBeNull();
    expect(score.band).toBeNull();
  });

  it("scores each group on its own", () => {
    const a = assessment({ scores: { nos: { a: 5, b: 5, c: 0 } } });
    const score = scoreSubject(a, a.subjects[0], t);
    expect(score.groups).toEqual([
      { group: "Perfil", score: 100, answered: 2, total: 2 },
      { group: "Conteúdo", score: 0, answered: 1, total: 1 },
    ]);
  });

  it("reads the band from the bands it is given", () => {
    expect(bandOf(90, defaultBands())).toBe("Referência");
    expect(bandOf(0, defaultBands())).toBe("Crítico");
    expect(bandOf(null, defaultBands())).toBeNull();
    expect(bandOf(60, [{ min: 0, label: "Único" }])).toBe("Único");
  });

  it("scores everyone compared", () => {
    const a = assessment({ scores: { nos: { a: 5 }, r1: { a: 1 } } });
    expect(scoreAll(a, t).map((s) => s.score)).toEqual([100, 20]);
  });
});

describe("gaps", () => {
  const t = template();

  it("ranks the groups where the client is furthest behind", () => {
    const a = assessment({
      subjects: [
        { id: "nos", name: "Aurora", kind: "cliente" },
        { id: "r1", name: "Rival A", kind: "concorrente" },
        { id: "r2", name: "Rival B", kind: "concorrente" },
      ],
      scores: {
        nos: { a: 2, b: 2, c: 4 },
        r1: { a: 5, b: 5, c: 1 },
        r2: { a: 3, b: 3, c: 5 },
      },
    });
    const out = gaps(a, t);
    expect(out[0]).toMatchObject({ group: "Perfil", ours: 40, theirs: 100, behind: 60, leader: "Rival A" });
    expect(out[1]).toMatchObject({ group: "Conteúdo", ours: 80, theirs: 100, behind: 20, leader: "Rival B" });
  });

  it("compares only the groups both sides rated", () => {
    // Nós avaliamos só Perfil; o concorrente, só Conteúdo. Não há comparação
    // honesta a fazer, e o módulo não inventa uma.
    const nothingInCommon = assessment({ scores: { nos: { a: 5, b: 5 }, r1: { c: 5 } } });
    expect(gaps(nothingInCommon, t)).toEqual([]);

    const common = assessment({ scores: { nos: { a: 5, b: 5, c: 1 }, r1: { c: 5 } } });
    expect(gaps(common, t).map((g) => g.group)).toEqual(["Conteúdo"]);
  });

  it("has nothing to say with no competitor", () => {
    const alone = assessment({ subjects: [{ id: "nos", name: "Aurora", kind: "cliente" }] });
    expect(gaps(alone, t)).toEqual([]);
  });
});

describe("conclude and reopen", () => {
  it("freezes a concluded analysis until someone reopens it", () => {
    expect(canEdit(assessment())).toBe(true);
    expect(canEdit(assessment({ status: "concluida" }))).toBe(false);
  });
});

describe("feeding the dossier", () => {
  const t = template();

  it("writes the score, the groups and where we lose", () => {
    const a = assessment({
      scores: { nos: { a: 2, b: 2, c: 4 }, r1: { a: 5, b: 5, c: 4 } },
      conclusions: "Começar pela bio e pelos destaques.",
    });
    const text = toDossierText(a, t);
    expect(text).toContain("Aurora: 50/100 (Mediano)");
    expect(text).toContain("• Perfil: 40/100");
    expect(text).toContain("Onde perdemos hoje:");
    expect(text).toContain("Perfil: 40 contra 100 de Concorrente A");
    expect(text).toContain("Começar pela bio");
  });

  it("says nothing about losing when we are ahead everywhere", () => {
    const a = assessment({ scores: { nos: { a: 5, b: 5, c: 5 }, r1: { a: 1, b: 1, c: 1 } } });
    expect(toDossierText(a, t)).not.toContain("Onde perdemos");
  });

  it("turns the competitors into the dossier's table rows", () => {
    const a = assessment({
      subjects: [
        { id: "nos", name: "Aurora", kind: "cliente" },
        {
          id: "r1",
          name: "Rival A",
          kind: "concorrente",
          handle: "@rival",
          followers: 12000,
          frequency: "4x por semana",
          notes: "direto",
        },
      ],
    });
    expect(toDossierRows(a)).toEqual([
      { nome: "Rival A", perfil: "@rival", seguidores: "12000", frequencia: "4x por semana", tipo: "direto" },
    ]);
  });
});
