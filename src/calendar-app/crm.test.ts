import { describe, expect, it } from "vitest";
import {
  DEFAULT_CRITERIA,
  MAX_ATTEMPTS,
  attemptsWithoutReply,
  cadenceAdvice,
  canEnterStage,
  dealIsBlocked,
  dealMonthlyValue,
  defaultStages,
  isBlocked,
  previewImport,
  probabilityOf,
  promoteToOpportunity,
  qualificationScore,
  stagesOf,
  stalled,
  temperatureOf,
  validateDeal,
  weightedPipeline,
  withoutNextStep,
} from "./crm";
import type { ContactBlock, Deal, Interaction } from "./types";

const stages = defaultStages();

const deal = (over: Partial<Deal> = {}): Deal => ({
  id: "d1",
  phase: "oportunidade",
  stageId: stagesOf(stages, "oportunidade")[0].id,
  name: "Padaria do Zé",
  recurringValue: 0,
  oneOffValue: 0,
  status: "aberto",
  contacts: [],
  createdAt: "2026-06-01T10:00:00.000Z",
  updatedAt: "2026-06-01T10:00:00.000Z",
  ...over,
});

const interaction = (over: Partial<Interaction> = {}): Interaction => ({
  id: "i1",
  dealId: "d1",
  kind: "mensagem",
  at: "2026-06-01T10:00:00.000Z",
  content: "Primeira abordagem",
  ...over,
});

describe("stages", () => {
  it("ships both funnels the spec describes", () => {
    expect(stagesOf(stages, "prospeccao").map((s) => s.name)).toEqual([
      "A abordar",
      "Abordado",
      "Respondeu",
      "Qualificado",
    ]);
    expect(stagesOf(stages, "oportunidade").map((s) => s.name)).toEqual([
      "Novo",
      "Contato feito",
      "Diagnóstico",
      "Proposta",
      "Negociação",
      "Ganho",
      "Perdido",
    ]);
  });

  it("has exactly one win and one loss stage in the opportunity funnel", () => {
    const funnel = stagesOf(stages, "oportunidade");
    expect(funnel.filter((s) => s.kind === "ganho")).toHaveLength(1);
    expect(funnel.filter((s) => s.kind === "perda")).toHaveLength(1);
  });

  it("refuses the proposal stage without a proposal attached", () => {
    const proposalStage = stages.find((s) => s.requiresProposal)!;
    expect(canEnterStage(deal(), proposalStage).ok).toBe(false);
    expect(canEnterStage(deal({ proposalId: "p1" }), proposalStage).ok).toBe(true);
  });

  it("promotes a prospect into the first opportunity stage", () => {
    const prospect = deal({ phase: "prospeccao", stageId: stagesOf(stages, "prospeccao")[0].id });
    const promoted = promoteToOpportunity(prospect, stages);
    expect(promoted.phase).toBe("oportunidade");
    expect(promoted.stageId).toBe(stagesOf(stages, "oportunidade")[0].id);
  });
});

describe("qualification", () => {
  it("adds the weights of what the record actually shows", () => {
    const rich = deal({
      company: "Padaria do Zé LTDA",
      segment: "Alimentação",
      recurringValue: 150000,
      nextStepOn: "2026-06-10",
      lastContactOn: "2026-06-02",
      contacts: [{ id: "c1", name: "Zé", email: "ze@padaria.com", primary: true }],
    });
    expect(qualificationScore(rich)).toBe(100);
    expect(temperatureOf(qualificationScore(rich))).toBe("quente");
  });

  it("gives nothing for an empty record", () => {
    expect(qualificationScore(deal())).toBe(0);
    expect(temperatureOf(0)).toBe("frio");
  });

  it("lands in the middle for a half-filled one", () => {
    const half = deal({ company: "X", segment: "Y", recurringValue: 1 });
    expect(qualificationScore(half)).toBe(55); // 15 + 15 + 25
    expect(temperatureOf(55)).toBe("morno");
  });

  it("never goes over 100, whatever the weights add up to", () => {
    const criteria = DEFAULT_CRITERIA.map((c) => ({ ...c, weight: 90 }));
    expect(qualificationScore(deal({ company: "X" }), criteria)).toBeLessThanOrEqual(100);
  });
});

describe("pipeline", () => {
  it("takes the stage probability unless the deal overrides it", () => {
    const negotiation = stages.find((s) => s.name === "Negociação")!;
    expect(probabilityOf(deal({ stageId: negotiation.id }), stages)).toBe(80);
    expect(probabilityOf(deal({ stageId: negotiation.id, probability: 50 }), stages)).toBe(50);
  });

  it("spreads a one-off over the year to get a monthly figure", () => {
    expect(dealMonthlyValue(deal({ recurringValue: 100000, oneOffValue: 120000 }))).toBe(110000);
  });

  it("weights the open pipeline and ignores closed deals", () => {
    const negotiation = stages.find((s) => s.name === "Negociação")!;
    const open = deal({ stageId: negotiation.id, recurringValue: 100000 });
    const won = deal({ id: "d2", status: "ganho", recurringValue: 999999 });
    expect(weightedPipeline([open, won], stages)).toBe(80000);
  });
});

describe("cadence", () => {
  it("counts attempts since the last reply", () => {
    const list = [
      interaction({ id: "1", at: "2026-06-01T10:00:00Z" }),
      interaction({ id: "2", at: "2026-06-03T10:00:00Z" }),
      interaction({ id: "3", at: "2026-06-05T10:00:00Z", answered: true }),
      interaction({ id: "4", at: "2026-06-07T10:00:00Z" }),
    ];
    expect(attemptsWithoutReply(list, "d1")).toBe(1);
  });

  it("does not count notes as attempts", () => {
    const list = [
      interaction({ id: "1", kind: "nota", content: "pensar no preço" }),
      interaction({ id: "2" }),
    ];
    expect(attemptsWithoutReply(list, "d1")).toBe(1);
  });

  it("follows the 2/4/7 rhythm", () => {
    const first = cadenceAdvice([interaction({ at: "2026-06-01T10:00:00Z" })], "d1");
    expect(first).toMatchObject({ attempts: 1, nextOn: "2026-06-03", giveUp: false });

    const second = cadenceAdvice(
      [
        interaction({ id: "1", at: "2026-06-01T10:00:00Z" }),
        interaction({ id: "2", at: "2026-06-03T10:00:00Z" }),
      ],
      "d1",
    );
    expect(second).toMatchObject({ attempts: 2, nextOn: "2026-06-07" });
  });

  it("says to give up after the third unanswered attempt", () => {
    const three = [1, 2, 3].map((n) =>
      interaction({ id: String(n), at: `2026-06-0${n}T10:00:00Z` }),
    );
    expect(cadenceAdvice(three, "d1")).toMatchObject({ attempts: 3, giveUp: true, nextOn: null });
    expect(MAX_ATTEMPTS).toBe(3);
  });

  it("has nothing to advise when they answered", () => {
    expect(cadenceAdvice([interaction({ answered: true })], "d1")).toMatchObject({
      attempts: 0,
      giveUp: false,
    });
  });
});

describe("blocklist", () => {
  const blocks: ContactBlock[] = [
    { id: "b1", kind: "email", value: "ze@padaria.com", at: "t", reason: "pediu para não receber" },
    { id: "b2", kind: "dominio", value: "concorrente.com", at: "t" },
    { id: "b3", kind: "telefone", value: "(61) 99999-0000", at: "t" },
  ];

  it("matches an exact address", () => {
    expect(isBlocked("ze@padaria.com", blocks)?.id).toBe("b1");
    expect(isBlocked("ZE@PADARIA.COM", blocks)?.id).toBe("b1");
    expect(isBlocked("outro@padaria.com", blocks)).toBeUndefined();
  });

  it("blocks every address of a blocked domain", () => {
    // Someone who asked not to be contacted did not mean "try my colleague".
    expect(isBlocked("qualquer@concorrente.com", blocks)?.id).toBe("b2");
  });

  it("compares phones by digits, not by formatting", () => {
    expect(isBlocked("61999990000", blocks)?.id).toBe("b3");
    expect(isBlocked("+55 61 99999-0000", blocks)).toBeUndefined(); // different number
  });

  it("finds a block through a deal's contacts", () => {
    const blocked = deal({
      contacts: [{ id: "c1", name: "Zé", email: "ze@padaria.com", primary: true }],
    });
    expect(dealIsBlocked(blocked, blocks)?.id).toBe("b1");
    expect(dealIsBlocked(deal(), blocks)).toBeUndefined();
  });

  it("ignores an empty value instead of matching everything", () => {
    expect(isBlocked("", blocks)).toBeUndefined();
    expect(isBlocked("   ", blocks)).toBeUndefined();
  });
});

describe("import preview", () => {
  const existing = [
    deal({
      id: "d1",
      name: "Padaria do Zé",
      document: "12.345.678/0001-90",
      contacts: [{ id: "c1", name: "Zé", email: "ze@padaria.com", phone: "61999990000", primary: true }],
    }),
  ];

  it("deduplicates by document, e-mail or phone", () => {
    const rows = [
      { name: "Outro nome", document: "12345678000190" },
      { name: "Outro nome", email: "ZE@padaria.com" },
      { name: "Outro nome", phone: "(61) 99999-0000" },
    ];
    expect(previewImport(rows, existing, []).map((p) => p.duplicateOf)).toEqual([
      "d1",
      "d1",
      "d1",
    ]);
  });

  it("treats the same name as a warning, never a match", () => {
    const preview = previewImport([{ name: "padaria do zé" }], existing, []);
    expect(preview[0].duplicateOf).toBeUndefined();
    expect(preview[0].warning).toContain("Padaria do Zé");
  });

  it("keeps a blocked contact out entirely", () => {
    const blocks: ContactBlock[] = [
      { id: "b", kind: "email", value: "nao@quero.com", at: "t", reason: "pediu" },
    ];
    const preview = previewImport([{ name: "X", email: "nao@quero.com" }], existing, blocks);
    expect(preview[0].blocked).toContain("bloqueado");
    expect(preview[0].duplicateOf).toBeUndefined();
  });

  it("lets a genuinely new row through clean", () => {
    const preview = previewImport([{ name: "Novo", email: "novo@x.com" }], existing, []);
    expect(preview[0]).toEqual({ row: { name: "Novo", email: "novo@x.com" } });
  });
});

describe("lists", () => {
  it("finds deals with nothing scheduled", () => {
    const withStep = deal({ id: "a", nextStepOn: "2026-06-10" });
    const withTask = deal({ id: "b" });
    const naked = deal({ id: "c" });
    const tasks = [{ id: "t", dealId: "b", title: "ligar", dueOn: "2026-06-10" }];
    expect(withoutNextStep([withStep, withTask, naked], tasks).map((d) => d.id)).toEqual(["c"]);
  });

  it("finds deals nobody has touched in a while", () => {
    const old = deal({ id: "a", lastContactOn: "2026-05-01" });
    const fresh = deal({ id: "b", lastContactOn: "2026-06-08" });
    expect(stalled([old, fresh], 14, "2026-06-10").map((d) => d.id)).toEqual(["a"]);
  });

  it("falls back to the creation date when nobody ever made contact", () => {
    const never = deal({ id: "a", createdAt: "2026-01-01T10:00:00.000Z" });
    expect(stalled([never], 14, "2026-06-10")).toHaveLength(1);
  });
});

describe("validation", () => {
  it("wants a name", () => {
    expect(validateDeal({ name: " " })).toBeTruthy();
    expect(validateDeal({ name: "Padaria" })).toBeNull();
  });
});
