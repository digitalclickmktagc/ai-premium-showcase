import { describe, expect, it } from "vitest";

import {
  AI_ACTIONS,
  SYSTEM_PROMPT,
  TASK_PROMPTS,
  actionById,
  buildRequest,
  previewRequest,
  contextConclusoesAnalise,
  contextFinanceiro,
  contextLegenda,
  contextProximoPasso,
  contextResumoDoDia,
  contextResumoFormulario,
  contextRoteiro,
  contextSugerirPautas,
  dossierBrief,
  parseJsonBlock,
  readPautaSuggestions,
  readSceneSuggestions,
  roughTokens,
  scrub,
  scrubText,
  tooBig,
} from "./ai";
import type {
  Assessment,
  AssessmentTemplate,
  BriefingForm,
  Deal,
  FinanceEntry,
  FormResponse,
  MonthlyPlan,
  Post,
} from "./types";

const post = (over: Partial<Post> = {}): Post =>
  ({
    id: "p1",
    calendarId: "c1",
    date: "2026-11-20",
    title: "Post de teste",
    description: "Uma descrição",
    contentType: "feed",
    status: "rascunho",
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...over,
  }) as Post;

describe("catálogo", () => {
  it("toda ação declara o que envia e tem id único", () => {
    const ids = AI_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const action of AI_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.what.length).toBeGreaterThan(0);
      expect(action.sends.length).toBeGreaterThan(0);
    }
  });

  it("acha a ação pelo id", () => {
    expect(actionById("escrever_legenda")?.apply).toBe("texto");
    expect(actionById("resumo_do_dia")?.apply).toBeNull();
  });
});

describe("limpeza do que é enviado", () => {
  it("troca e-mail, telefone e documento por rótulos", () => {
    const text = scrubText(
      "Fale com contato@cliente.com.br ou (11) 98888-7777. CNPJ 12.345.678/0001-90.",
    );
    expect(text).toContain("[e-mail]");
    expect(text).toContain("[telefone]");
    expect(text).toContain("[documento]");
    expect(text).not.toContain("cliente.com.br");
    expect(text).not.toContain("98888");
    expect(text).not.toContain("12.345.678");
  });

  it("deixa o texto comum intacto", () => {
    expect(scrubText("Campanha de novembro com 3 posts")).toBe(
      "Campanha de novembro com 3 posts",
    );
  });

  it("remove campos proibidos em qualquer profundidade", () => {
    const cleaned = scrub({
      nome: "Padaria do Zé",
      email: "ze@padaria.com",
      contato: { phone: "11988887777", nome: "Zé" },
      lista: [{ shareToken: "abc123", titulo: "ok" }],
      internalNotes: "não mandar",
    }) as Record<string, unknown>;
    expect(cleaned.nome).toBe("Padaria do Zé");
    expect(cleaned.email).toBeUndefined();
    expect(cleaned.internalNotes).toBeUndefined();
    expect(cleaned.contato).toBeUndefined();
    expect((cleaned.lista as Record<string, unknown>[])[0].shareToken).toBeUndefined();
    expect((cleaned.lista as Record<string, unknown>[])[0].titulo).toBe("ok");
  });

  it("pega variações de grafia dos campos proibidos", () => {
    const cleaned = scrub({
      API_KEY: "x",
      "e-mail": "a@b.com",
      Telefone: "119",
      share_token: "t",
      senha: "123",
      titulo: "fica",
    }) as Record<string, unknown>;
    expect(Object.keys(cleaned)).toEqual(["titulo"]);
  });

  it("limpa dado pessoal escondido em texto livre", () => {
    const cleaned = scrub({ briefing: "Mandar para joao@x.com antes de sexta" }) as {
      briefing: string;
    };
    expect(cleaned.briefing).toBe("Mandar para [e-mail] antes de sexta");
  });
});

describe("resumo do dia", () => {
  const clientOf = () => "Padaria do Zé";

  it("avisa quando não há o que resumir", () => {
    const ctx = contextResumoDoDia({
      today: "2026-11-23",
      late: [],
      waiting: [],
      dueToday: [],
      overdue: [],
      tasks: [],
      clientOf,
    });
    expect(ctx.missing).toBeTruthy();
    expect(ctx.data).toEqual({});
  });

  it("manda título, data e cliente — e valor em reais", () => {
    const ctx = contextResumoDoDia({
      today: "2026-11-23",
      late: [post({ title: "Reels de sexta" })],
      waiting: [],
      dueToday: [],
      overdue: [{ description: "Hospedagem", amount: 12990, nature: "despesa" }],
      tasks: [],
      clientOf,
    });
    expect(ctx.missing).toBeUndefined();
    const data = ctx.data as Record<string, { titulo?: string; valor_reais?: number }[]>;
    expect(data.posts_atrasados[0].titulo).toBe("Reels de sexta");
    expect(data.contas_vencidas[0].valor_reais).toBe(129.9);
  });

  it("não manda uma lista sem fim", () => {
    const many = Array.from({ length: 50 }, (_, i) => post({ id: `p${i}`, title: `P${i}` }));
    const ctx = contextResumoDoDia({
      today: "2026-11-23",
      late: many,
      waiting: [],
      dueToday: [],
      overdue: [],
      tasks: [],
      clientOf,
    });
    expect((ctx.data.posts_atrasados as unknown[]).length).toBe(20);
  });
});

describe("sugerir pautas", () => {
  const plan: MonthlyPlan = {
    id: "pl1",
    clientId: "cl1",
    month: "2026-11",
    goals: [{ id: "g1", name: "Seguidores", target: "1000" }],
    objectives: [{ id: "o1", text: "Mais alcance", indicator: "impressões" }],
    improvements: ["Mais vídeo"],
    pillars: [
      { id: "pi1", name: "Bastidores", share: 60 },
      { id: "pi2", name: "Produto", share: 40 },
    ],
    funnel: { descoberta: 40, interesse: 30, conversao: 20, fidelizacao: 10 },
    actions: [],
    status: "rascunho",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  } as MonthlyPlan;

  it("sem planejamento, não chama a IA", () => {
    const ctx = contextSugerirPautas({
      clientName: "Padaria",
      month: "2026-11",
      plan: undefined,
      items: [],
      quantity: 5,
    });
    expect(ctx.missing).toContain("planejamento");
  });

  it("manda pilares, funil e o que já está na pauta", () => {
    const ctx = contextSugerirPautas({
      clientName: "Padaria",
      month: "2026-11",
      plan,
      items: [
        {
          id: "i1",
          clientId: "cl1",
          date: "2026-11-05",
          kind: "post",
          title: "Pão quentinho",
          channels: [],
          pillarId: "pi1",
          status: "ideia",
          createdAt: "",
          updatedAt: "",
        },
      ],
      quantity: 4,
    });
    const data = ctx.data as Record<string, unknown>;
    expect(data.quantas_sugestoes).toBe(4);
    expect((data.pilares as { nome: string }[])[0].nome).toBe("Bastidores");
    expect((data.ja_na_pauta as { pilar?: string }[])[0].pilar).toBe("Bastidores");
  });
});

describe("legenda e roteiro", () => {
  it("exige título", () => {
    expect(
      contextLegenda({ post: post({ title: "  " }), clientName: "X" }).missing,
    ).toBeTruthy();
    expect(
      contextRoteiro({ post: post({ title: "" }), clientName: "X", kind: "video", seconds: 30 })
        .missing,
    ).toBeTruthy();
  });

  it("corta descrição muito longa", () => {
    const ctx = contextLegenda({
      post: post({ description: "a".repeat(2000) }),
      clientName: "X",
    });
    expect((ctx.data.descricao as string).length).toBeLessThanOrEqual(801);
    expect(ctx.data.descricao as string).toContain("…");
  });

  it("diz à IA que stories são telas verticais", () => {
    const ctx = contextRoteiro({
      post: post(),
      clientName: "X",
      kind: "stories",
      seconds: 45,
    });
    expect(ctx.data.tipo_de_roteiro as string).toContain("9:16");
    expect(ctx.data.duracao_alvo_segundos).toBe(45);
  });
});

describe("conclusões da análise", () => {
  const template: AssessmentTemplate = {
    id: "t1",
    name: "Padrão",
    questions: [{ id: "q1", group: "Conteúdo", label: "Frequência", weight: 2 }],
    bands: [],
    createdAt: "",
    updatedAt: "",
  } as AssessmentTemplate;

  const base: Assessment = {
    id: "a1",
    clientId: "cl1",
    templateId: "t1",
    title: "Análise 2026",
    subjects: [{ id: "s1", name: "Cliente", kind: "cliente" }],
    scores: {},
    status: "em_andamento",
    createdAt: "",
    updatedAt: "",
  } as Assessment;

  it("sem nota, não chama a IA", () => {
    expect(
      contextConclusoesAnalise({ assessment: base, template, scores: [], gaps: [] }).missing,
    ).toBeTruthy();
  });

  it("com nota, manda o placar e onde perdemos", () => {
    const ctx = contextConclusoesAnalise({
      assessment: { ...base, scores: { s1: { q1: 4 } } },
      template,
      scores: [{ name: "Cliente", kind: "cliente", score: 80, band: "Bom" }],
      gaps: [{ group: "Conteúdo", ours: 80, theirs: 95, leader: "Concorrente A" }],
    });
    expect(ctx.missing).toBeUndefined();
    expect((ctx.data.onde_perdemos as { leader: string }[])[0].leader).toBe("Concorrente A");
  });
});

describe("explicar o mês", () => {
  const entry = (over: Partial<FinanceEntry>): FinanceEntry =>
    ({
      id: "e1",
      nature: "despesa",
      description: "Conta",
      amount: 10000,
      competence: "2026-11",
      dueDate: "2026-11-10",
      status: "previsto",
      createdAt: "",
      updatedAt: "",
      ...over,
    }) as FinanceEntry;

  it("avisa quando o mês está vazio", () => {
    const ctx = contextFinanceiro({
      month: "2026-11",
      entries: [entry({ competence: "2026-10" })],
      categoryName: () => "Outros",
    });
    expect(ctx.missing).toBeTruthy();
  });

  it("soma em reais e agrupa despesa por categoria", () => {
    const ctx = contextFinanceiro({
      month: "2026-11",
      entries: [
        entry({ id: "r1", nature: "receita", amount: 250000, status: "liquidado" }),
        entry({ id: "d1", amount: 30000, categoryId: "c1" }),
        entry({ id: "d2", amount: 20000, categoryId: "c1" }),
      ],
      categoryName: (id) => (id === "c1" ? "Ferramentas" : "Outros"),
    });
    const data = ctx.data as Record<string, unknown>;
    expect(data.receita_total_reais).toBe(2500);
    expect(data.despesa_total_reais).toBe(500);
    expect(data.receita_liquidada_reais).toBe(2500);
    expect(data.despesas_por_categoria).toEqual([
      { categoria: "Ferramentas", valor_reais: 500 },
    ]);
  });
});

describe("próximo passo do CRM", () => {
  it("manda o histórico mas não o contato", () => {
    const deal = {
      id: "d1",
      name: "Padaria do Zé",
      company: "Padaria",
      stageId: "st1",
      recurringValue: 150000,
      oneOffValue: 0,
      contacts: [{ name: "Zé", email: "ze@padaria.com", phone: "11988887777" }],
      createdAt: "",
      updatedAt: "",
    } as unknown as Deal;
    const ctx = contextProximoPasso({
      deal,
      stageName: "Proposta",
      interactions: [
        { id: "i1", dealId: "d1", kind: "ligacao", content: "Pediu proposta", at: "2026-11-10T12:00:00.000Z" },
      ] as never,
      daysSinceContact: 13,
    });
    const raw = JSON.stringify(ctx.data);
    expect(raw).not.toContain("ze@padaria.com");
    expect(raw).not.toContain("11988887777");
    expect(ctx.data.valor_mensal_reais).toBe(1500);
    expect(ctx.data.dias_sem_interacao).toBe(13);
  });
});

describe("resumo de formulário", () => {
  const form = {
    id: "f1",
    title: "Briefing inicial",
    questions: [{ id: "q1", label: "Qual o objetivo?", kind: "texto", required: true }],
    status: "ativo",
    createdAt: "",
    updatedAt: "",
  } as unknown as BriefingForm;

  it("sem resposta, não chama a IA", () => {
    expect(contextResumoFormulario({ form, responses: [] }).missing).toBeTruthy();
  });

  it("só usa as respostas deste formulário", () => {
    const responses = [
      { id: "r1", formId: "f1", answers: { q1: "Vender mais" }, at: "2026-11-01T00:00:00.000Z" },
      { id: "r2", formId: "outro", answers: { q1: "Nada a ver" }, at: "2026-11-02T00:00:00.000Z" },
    ] as unknown as FormResponse[];
    const ctx = contextResumoFormulario({ form, responses });
    expect((ctx.data.respostas as unknown[]).length).toBe(1);
  });
});

describe("dossiê em texto", () => {
  it("junta as seções preenchidas e ignora as vazias", () => {
    const brief = dossierBrief(
      {
        id: "d1",
        clientId: "cl1",
        templateId: "t1",
        sections: [
          { sectionId: "s1", text: "Tom descontraído" },
          { sectionId: "s2", text: "   " },
        ],
        createdAt: "",
        updatedAt: "",
      } as never,
      {
        id: "t1",
        name: "Padrão",
        sections: [
          { id: "s1", title: "Tom de voz", kind: "texto", defaultVisibility: "cliente" },
          { id: "s2", title: "Vazia", kind: "texto", defaultVisibility: "cliente" },
        ],
        createdAt: "",
        updatedAt: "",
      } as never,
    );
    expect(brief).toEqual([{ titulo: "Tom de voz", conteudo: "Tom descontraído" }]);
  });

  it("devolve lista vazia sem dossiê", () => {
    expect(dossierBrief(undefined, undefined)).toEqual([]);
  });
});

describe("leitura da resposta", () => {
  it("lê JSON puro, cercado de texto ou em bloco de código", () => {
    expect(parseJsonBlock<{ a: number }>('{"a":1}')?.a).toBe(1);
    expect(parseJsonBlock<{ a: number }>('Claro!\n```json\n{"a":2}\n```')?.a).toBe(2);
    expect(parseJsonBlock<{ a: number }>('Aqui vai: {"a":3} — pronto.')?.a).toBe(3);
  });

  it("devolve null em vez de quebrar", () => {
    expect(parseJsonBlock("desculpe, não consegui")).toBeNull();
    expect(parseJsonBlock("{ quebrado")).toBeNull();
  });

  it("descarta pauta sem título e normaliza o resto", () => {
    const list = readPautaSuggestions(
      JSON.stringify({
        pautas: [
          { titulo: "  Pão quentinho ", data: "2026-11-05", onde: "story" },
          { titulo: "", data: "2026-11-06" },
          { titulo: "Sem data", data: "amanhã" },
        ],
      }),
    );
    expect(list.length).toBe(2);
    expect(list[0]).toMatchObject({ titulo: "Pão quentinho", onde: "story" });
    expect(list[1].data).toBeUndefined();
    expect(list[1].onde).toBe("post");
  });

  it("aceita o array direto", () => {
    expect(readPautaSuggestions('[{"titulo":"A"}]').length).toBe(1);
  });

  it("lê cenas e descarta duração absurda", () => {
    const cenas = readSceneSuggestions(
      JSON.stringify({ cenas: [{ fala: "Oi", segundos: 5 }, { fala: "Tchau", segundos: 9999 }, {}] }),
    );
    expect(cenas.length).toBe(2);
    expect(cenas[0].segundos).toBe(5);
    expect(cenas[1].segundos).toBeUndefined();
  });

  it("não devolve mais que o teto de cenas", () => {
    const muitas = Array.from({ length: 90 }, (_, i) => ({ fala: `C${i}` }));
    expect(readSceneSuggestions(JSON.stringify({ cenas: muitas })).length).toBe(60);
  });
});

describe("tamanho do envio", () => {
  it("barra contexto absurdo", () => {
    expect(tooBig({ a: "x" })).toBe(false);
    expect(roughTokens({})).toBeGreaterThan(0);
    expect(tooBig({ a: "x".repeat(500_000) })).toBe(true);
  });
});

describe("instruções", () => {
  it("toda ação tem instrução própria", () => {
    for (const action of AI_ACTIONS) {
      expect(TASK_PROMPTS[action.id]).toBeTruthy();
    }
  });

  it("o sistema proíbe inventar dado", () => {
    expect(SYSTEM_PROMPT).toContain("Não invente");
    expect(SYSTEM_PROMPT).toContain("sugere");
  });

  it("ações que viram JSON pedem JSON", () => {
    expect(TASK_PROMPTS.sugerir_pautas).toContain("JSON");
    expect(TASK_PROMPTS.rascunhar_roteiro).toContain("JSON");
    expect(TASK_PROMPTS.escrever_legenda).not.toContain("JSON");
  });

  it("o preview mostra instrução e dados", () => {
    const req = buildRequest("escrever_legenda", {
      data: { titulo: "Pão quentinho" },
    });
    const preview = previewRequest(req);
    expect(preview).toContain("legenda");
    expect(preview).toContain("Pão quentinho");
  });

  it("recusa ação inexistente", () => {
    expect(() => buildRequest("nao_existe" as never, { data: {} })).toThrow();
  });
});

describe("falso positivo da limpeza", () => {
  it("não derruba campo legítimo que contém uma palavra proibida como pedaço", () => {
    const cleaned = scrub({
      dias_sem_interacao: 13,
      tokenizacao: "fica",
      documentario: "fica",
      share_token: "cai",
    }) as Record<string, unknown>;
    expect(cleaned.dias_sem_interacao).toBe(13);
    expect(cleaned.tokenizacao).toBe("fica");
    expect(cleaned.documentario).toBe("fica");
    expect(cleaned.share_token).toBeUndefined();
  });
});
