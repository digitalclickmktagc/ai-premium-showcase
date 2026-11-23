import type { Database } from "../types";
import { shareToken, toDayISO, uid } from "../utils";
import { defaultTemplate as defaultDossierTemplate } from "../dossier";
import { defaultTemplate as defaultAssessmentTemplate } from "../assessment";
import { newSecret } from "../webhooks";

/**
 * Demo dataset used the first time the app runs with the localStorage adapter.
 * Posts are placed relative to "today" so the current month always looks
 * populated regardless of when the app is opened.
 */
export function buildSeed(): Database {
  const now = new Date();
  const iso = now.toISOString();
  const year = now.getFullYear();
  const month = now.getMonth();

  /** A day in the current month, clamped to a valid date. */
  const day = (d: number) => {
    const last = new Date(year, month + 1, 0).getDate();
    return toDayISO(new Date(year, month, Math.min(Math.max(d, 1), last)));
  };

  const aurora = {
    id: uid("cli"),
    name: "Aurora Café",
    color: "#f97316",
    handle: "@auroracafe",
    email: "contato@auroracafe.com.br",
    status: "active" as const,
    active: true,
    segment: "Alimentação",
    createdAt: iso,
  };
  const lumina = {
    id: uid("cli"),
    name: "Lumina Studio",
    color: "#8b5cf6",
    handle: "@luminastudio",
    status: "active" as const,
    active: true,
    segment: "Serviços criativos",
    createdAt: iso,
  };
  const vitta = {
    id: uid("cli"),
    name: "Vitta Fit",
    color: "#22c55e",
    handle: "@vittafit",
    status: "paused" as const,
    active: false,
    segment: "Saúde e bem-estar",
    createdAt: iso,
  };

  const auroraCal = {
    id: uid("cal"),
    clientId: aurora.id,
    name: "Calendário Aurora Café",
    shareToken: shareToken(),
    createdAt: iso,
  };
  const luminaCal = {
    id: uid("cal"),
    clientId: lumina.id,
    name: "Calendário Lumina Studio",
    shareToken: shareToken(),
    createdAt: iso,
  };
  const vittaCal = {
    id: uid("cal"),
    clientId: vitta.id,
    name: "Calendário Vitta Fit",
    shareToken: shareToken(),
    createdAt: iso,
  };

  const mk = (
    calendarId: string,
    p: {
      title: string;
      date: string;
      status: Database["posts"][number]["status"];
      description?: string;
      contentType?: string;
      referenceLink?: string;
      internalNotes?: string;
      rescheduleHistory?: Database["posts"][number]["rescheduleHistory"];
    },
  ) => ({
    id: uid("post"),
    calendarId,
    title: p.title,
    date: p.date,
    status: p.status,
    description: p.description ?? "",
    contentType: p.contentType,
    referenceLink: p.referenceLink,
    internalNotes: p.internalNotes,
    rescheduleHistory: p.rescheduleHistory ?? [],
    createdAt: iso,
    updatedAt: iso,
  });

  const posts: Database["posts"] = [
    // Aurora Café
    mk(auroraCal.id, {
      title: "Novo blend de inverno",
      date: day(3),
      status: "published",
      contentType: "Feed",
      description:
        "Apresentação do blend sazonal de inverno com notas de chocolate e avelã. Foto do grão + xícara fumegante.",
      referenceLink: "https://drive.google.com/exemplo-briefing",
      internalNotes: "Confirmar se a foto do grão já foi aprovada pelo cliente.",
    }),
    mk(auroraCal.id, {
      title: "Bastidores da torra",
      date: day(7),
      status: "done",
      contentType: "Reels",
      description: "Vídeo curto mostrando o processo de torra artesanal.",
    }),
    mk(auroraCal.id, {
      title: "Enquete: seu café preferido",
      date: day(12),
      status: "todo",
      contentType: "Story",
      description: "Sequência de stories com enquete interativa.",
    }),
    mk(auroraCal.id, {
      title: "Combo café + brownie",
      date: day(18),
      status: "rescheduled",
      contentType: "Carrossel",
      description: "Divulgação da promoção de combo da semana.",
      rescheduleHistory: [{ from: day(15), to: day(18), at: iso }],
      internalNotes: "Cliente pediu para mover por conta de feriado.",
    }),
    mk(auroraCal.id, {
      title: "Depoimento de cliente",
      date: day(24),
      status: "todo",
      contentType: "Feed",
      description: "Card com depoimento e foto do cliente frequente.",
    }),

    // Lumina Studio
    mk(luminaCal.id, {
      title: "Case: ensaio corporativo",
      date: day(2),
      status: "published",
      contentType: "Carrossel",
      description: "Antes e depois de um ensaio corporativo recente.",
    }),
    mk(luminaCal.id, {
      title: "Dica de iluminação",
      date: day(9),
      status: "done",
      contentType: "Reels",
      description: "Dica rápida de iluminação natural para retratos.",
    }),
    mk(luminaCal.id, {
      title: "Promo ensaio gestante",
      date: day(16),
      status: "todo",
      contentType: "Feed",
      description: "Divulgação do pacote de ensaio gestante do mês.",
      internalNotes: "Aguardando valores finais do pacote.",
    }),
    // Deliberately late: gives the relationship index something to report.
    mk(luminaCal.id, {
      title: "Reels de bastidores (atrasado)",
      date: day(1),
      status: "todo",
      contentType: "Reels",
      description: "Era para ter saído no início do mês.",
    }),
    mk(luminaCal.id, {
      title: "Behind the scenes",
      date: day(22),
      status: "todo",
      contentType: "Story",
      description: "Bastidores do estúdio em dia de gravação.",
    }),

    // Vitta Fit
    mk(vittaCal.id, {
      title: "Treino do dia",
      date: day(5),
      status: "published",
      contentType: "Reels",
      description: "Série de exercícios funcionais para iniciantes.",
    }),
    mk(vittaCal.id, {
      title: "Receita pós-treino",
      date: day(14),
      status: "todo",
      contentType: "Feed",
      description: "Receita rápida e proteica para o pós-treino.",
    }),
    mk(vittaCal.id, {
      title: "Post antigo (removido)",
      date: day(10),
      status: "deleted",
      contentType: "Feed",
      description: "Conteúdo cancelado — mantido como histórico.",
      internalNotes: "Cancelado pelo cliente.",
    }),
  ];

  // ── Módulos novos: exemplos para a demonstração ──────────────
  // Tudo abaixo só existe no adaptador localStorage. Em produção os módulos
  // nascem vazios, como devem nascer.

  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const auroraPost = posts.find((p) => p.calendarId === auroraCal.id)!;
  const luminaPost = posts.find((p) => p.calendarId === luminaCal.id)!;

  // Financeiro
  const conta = {
    id: uid("acc"),
    name: "Banco principal",
    kind: "banco" as const,
    initialBalance: 450000,
    initialBalanceDate: day(1),
    active: true,
    createdAt: iso,
  };
  const catReceita = {
    id: uid("cat"),
    name: "Mensalidades",
    nature: "receita" as const,
    active: true,
  };
  const catDespesa = {
    id: uid("cat"),
    name: "Tráfego pago",
    nature: "despesa" as const,
    active: true,
  };

  // Projetos e squad
  const squad = {
    id: uid("sqd"),
    name: "Squad Aurora",
    lead: "Ana",
    members: ["Ana", "Bruno"],
    description: "Time que toca os clientes de alimentação.",
    createdAt: iso,
    updatedAt: iso,
  };
  const projeto = {
    id: uid("prj"),
    name: "Gestão de redes — Aurora",
    clientId: aurora.id,
    squadId: squad.id,
    dueDate: day(28),
    value: 1200000,
    status: "ativo" as const,
    createdAt: iso,
    updatedAt: iso,
  };
  const projetoAtrasado = {
    id: uid("prj"),
    name: "Campanha de inverno — Lumina",
    clientId: lumina.id,
    squadId: squad.id,
    dueDate: day(2),
    value: 350000,
    status: "ativo" as const,
    createdAt: iso,
    updatedAt: iso,
  };
  auroraPost.projectId = projeto.id;
  luminaPost.projectId = projetoAtrasado.id;

  // Dossiê
  const dossierTemplate = defaultDossierTemplate(iso);
  const dossier = {
    id: uid("dos"),
    clientId: aurora.id,
    templateId: dossierTemplate.id,
    sections: [
      {
        sectionId: "visao",
        visibility: "cliente" as const,
        text: "Virar referência de café especial no bairro e crescer o delivery.",
      },
      {
        sectionId: "persona",
        visibility: "cliente" as const,
        values: {
          identidade: "Adulto de 25 a 40 anos, trabalha perto",
          dores: "Fila no balcão no horário de pico",
          desejos: "Café bom sem perder a hora do almoço",
        },
      },
      {
        sectionId: "raiox",
        visibility: "interno" as const,
        values: { veredito: "Feed sem padrão visual e bio sem chamada." },
      },
      { sectionId: "editorial", visibility: "cliente" as const, list: ["Educar sobre origem", "Bastidores da torra", "Oferta do dia"] },
    ],
    shareToken: shareToken(),
    shareEnabled: true,
    createdAt: iso,
    updatedAt: iso,
  };

  // Análise de perfil
  const assessmentTemplate = defaultAssessmentTemplate(iso);
  const nosId = uid("subj");
  const rivalId = uid("subj");
  const assessment = {
    id: uid("anal"),
    clientId: aurora.id,
    templateId: assessmentTemplate.id,
    title: "Análise de Aurora Café",
    subjects: [
      { id: nosId, name: "Aurora Café", kind: "cliente" as const, handle: "@auroracafe", followers: 3200 },
      { id: rivalId, name: "Café do Largo", kind: "concorrente" as const, handle: "@cafedolargo", followers: 11800, frequency: "5x por semana" },
    ],
    scores: {
      [nosId]: { bio: 2, identidade: 3, frequencia: 4, formatos: 3, engajamento: 3, reputacao: 4 },
      [rivalId]: { bio: 5, identidade: 4, frequencia: 5, formatos: 4, engajamento: 2, reputacao: 3 },
    },
    conclusions: "Reescrever a bio e padronizar as capas antes de pensar em anúncio.",
    status: "em_andamento" as const,
    createdAt: iso,
    updatedAt: iso,
  };

  // Pauta e planejamento
  const pilarEducar = uid("pil");
  const pilarVender = uid("pil");
  const plan = {
    id: uid("pln"),
    clientId: aurora.id,
    month: monthKey,
    goals: [{ id: uid("gol"), name: "Seguidores", target: "4.000", previous: "3.200" }],
    objectives: [{ id: uid("obj"), text: "Aumentar pedidos no delivery", indicator: "Pedidos/semana" }],
    improvements: ["Padronizar capas dos reels"],
    pillars: [
      { id: pilarEducar, name: "Educar", share: 60 },
      { id: pilarVender, name: "Vender", share: 40 },
    ],
    funnel: { descoberta: 50, interesse: 20, conversao: 20, fidelizacao: 10 },
    actions: [{ id: uid("act"), title: "Campanha do combo de inverno", channel: "Instagram", startsOn: day(10), budget: 60000 }],
    status: "rascunho" as const,
    createdAt: iso,
    updatedAt: iso,
  };
  const pautaItems = [
    {
      id: uid("pau"),
      clientId: aurora.id,
      date: day(21),
      kind: "post" as const,
      title: "Como escolher um café especial",
      channels: ["instagram"],
      format: "carrossel",
      briefing: "Três critérios simples, com foto de cada etapa.",
      pillarId: pilarEducar,
      funnel: "descoberta" as const,
      status: "pronta" as const,
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: uid("pau"),
      clientId: aurora.id,
      date: day(24),
      kind: "story" as const,
      title: "Enquete: qual combo você quer de volta?",
      channels: ["instagram"],
      pillarId: pilarVender,
      funnel: "interesse" as const,
      status: "ideia" as const,
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: uid("pau"),
      clientId: aurora.id,
      date: auroraPost.date,
      kind: "post" as const,
      title: auroraPost.title,
      channels: ["instagram"],
      pillarId: pilarEducar,
      funnel: "descoberta" as const,
      status: "convertida" as const,
      postId: auroraPost.id,
      calendarId: auroraCal.id,
      createdAt: iso,
      updatedAt: iso,
    },
  ];

  // Banco de ideias
  const ideas = [
    {
      id: uid("ide"),
      text: "Série de bastidores da torra #reels #cafe",
      scope: { kind: "cliente" as const, clientId: aurora.id },
      tags: ["reels", "cafe"],
      mentions: [],
      format: "reels",
      status: "na_pauta" as const,
      votes: ["admin@digitalclick.com", "bruno"],
      usedBy: [],
      createdBy: "admin@digitalclick.com",
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: uid("ide"),
      text: "Comparar métodos de preparo em #carrossel",
      scope: { kind: "geral" as const },
      tags: ["carrossel"],
      mentions: [],
      format: "carrossel",
      status: "nova" as const,
      votes: ["admin@digitalclick.com"],
      usedBy: [],
      createdBy: "admin@digitalclick.com",
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: uid("ide"),
      text: "Depoimento de cliente antigo @ana #prova",
      scope: { kind: "geral" as const },
      tags: ["prova"],
      mentions: ["ana"],
      status: "nova" as const,
      votes: [],
      usedBy: [],
      createdBy: "admin@digitalclick.com",
      createdAt: iso,
      updatedAt: iso,
    },
  ];

  // Roteiro, preso ao card
  const script = {
    id: uid("rot"),
    postId: auroraPost.id,
    kind: "video" as const,
    title: `Roteiro — ${auroraPost.title}`,
    goal: "Mostrar o cuidado da torra e puxar para o delivery",
    audience: "Quem já conhece a casa",
    tone: "Próximo, sem formalidade",
    cta: "Peça pelo link da bio",
    scenes: [
      { id: uid("cen"), shot: "Close", seconds: 5, speech: "Olha o que acontece antes do seu café chegar.", onScreen: "Torra do dia" },
      { id: uid("cen"), shot: "Meio", seconds: 8, speech: "A gente torra em pequenos lotes, todo dia de manhã.", notes: "Gravar antes das 7h, luz melhor" },
      { id: uid("cen"), shot: "Geral", seconds: 5, speech: "Peça pelo link da bio e receba ainda hoje.", onScreen: "Link na bio" },
    ],
    fields: ["shot", "onScreen", "seconds", "notes"],
    status: "rascunho" as const,
    version: 1,
    createdAt: iso,
    updatedAt: iso,
  };

  // Formulário de briefing, com respostas
  const form = {
    id: uid("frm"),
    title: "Briefing de campanha",
    description: "Dois minutos para a gente começar do jeito certo.",
    clientId: aurora.id,
    questions: [
      { id: "obj", kind: "texto_longo" as const, label: "Qual o objetivo desta campanha?", required: true },
      { id: "nps", kind: "nota10" as const, label: "De 0 a 10, o quanto recomendaria nosso trabalho?", required: false },
      { id: "tom", kind: "lista" as const, label: "Tom da comunicação", required: false, options: ["Formal", "Informal"] },
      { id: "canais", kind: "multipla" as const, label: "Onde vamos publicar?", required: false, options: ["Instagram", "TikTok", "LinkedIn"] },
    ],
    status: "ativo" as const,
    shareToken: shareToken(),
    createdAt: iso,
    updatedAt: iso,
  };
  const formResponses = [
    {
      id: uid("res"),
      formId: form.id,
      answers: { obj: "Vender mais no delivery", nps: 9, tom: "Informal", canais: ["Instagram"] },
      respondent: "Marina (Aurora Café)",
      at: iso,
    },
    {
      id: uid("res"),
      formId: form.id,
      answers: { obj: "Aparecer mais no bairro", nps: 6, tom: "Formal", canais: ["Instagram", "TikTok"] },
      at: iso,
    },
  ];

  // CRM
  const deals = [
    {
      id: uid("deal"),
      phase: "oportunidade" as const,
      stageId: "stage:oportunidade:3",
      name: "Clínica Bem Viver",
      company: "Bem Viver Saúde",
      segment: "Saúde",
      city: "Brasília",
      origin: "indicação",
      recurringValue: 250000,
      oneOffValue: 0,
      status: "aberto" as const,
      nextStepOn: day(22),
      contacts: [
        {
          id: uid("ctt"),
          name: "Bruno Martins",
          email: "bruno@bemviver.com",
          phone: "61988880000",
          primary: true,
          source: "indicação de cliente",
          collectedAt: iso,
          lawfulBasis: "legítimo interesse",
        },
      ],
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: uid("deal"),
      phase: "prospeccao" as const,
      stageId: "stage:prospeccao:1",
      name: "Auto Peças Norte",
      segment: "Varejo",
      city: "Brasília",
      origin: "mapa",
      recurringValue: 90000,
      oneOffValue: 0,
      status: "aberto" as const,
      contacts: [],
      createdAt: iso,
      updatedAt: iso,
    },
  ];
  const crmTasks = [
    { id: uid("tsk"), dealId: deals[0].id, title: "Ligar sobre a proposta enviada", dueOn: day(new Date().getDate()) },
  ];
  const blocks = [
    { id: uid("blk"), kind: "dominio" as const, value: "naoquero.com.br", reason: "pediu para não receber", at: iso },
  ];

  // Catálogo e proposta
  const services = [
    {
      id: uid("svc"),
      name: "Gestão de redes sociais",
      description: "Planejamento, produção e publicação mensal.",
      included: ["12 posts por mês", "Stories semanais", "Relatório mensal"],
      price: 180000,
      billing: "mensal" as const,
      active: true,
      publicInTable: true,
      order: 0,
      createdAt: iso,
    },
    {
      id: uid("svc"),
      name: "Gestão de tráfego pago",
      description: "Campanhas, públicos e otimização semanal.",
      price: 120000,
      billing: "mensal" as const,
      active: true,
      publicInTable: true,
      order: 1,
      createdAt: iso,
    },
  ];
  const proposals = [
    {
      id: uid("prp"),
      number: "2026-001",
      title: "Proposta — Clínica Bem Viver",
      clientId: undefined,
      leadName: "Clínica Bem Viver",
      validUntil: day(28),
      status: "enviada" as const,
      linkId: shareToken(),
      items: [
        {
          id: uid("itm"),
          serviceId: services[0].id,
          description: "Gestão de redes sociais",
          quantity: 1,
          unitPrice: 180000,
          billing: "mensal" as const,
        },
        {
          id: uid("itm"),
          description: "Ensaio fotográfico de abertura",
          quantity: 1,
          unitPrice: 90000,
          billing: "unica" as const,
        },
      ],
      views: [],
      sentAt: iso,
      version: 1,
      createdAt: iso,
      updatedAt: iso,
    },
  ];

  // Lançamentos financeiros, ligados ao projeto
  const entries = [
    {
      id: uid("fin"),
      nature: "receita" as const,
      description: "Mensalidade Aurora Café",
      amount: 180000,
      dueDate: day(5),
      competence: monthKey,
      status: "liquidado" as const,
      settledAt: day(5),
      accountId: conta.id,
      categoryId: catReceita.id,
      clientId: aurora.id,
      projectId: projeto.id,
      origin: "manual" as const,
      createdAt: iso,
    },
    {
      id: uid("fin"),
      nature: "receita" as const,
      description: "Mensalidade Lumina Studio",
      amount: 150000,
      dueDate: day(25),
      competence: monthKey,
      status: "previsto" as const,
      accountId: conta.id,
      categoryId: catReceita.id,
      clientId: lumina.id,
      origin: "manual" as const,
      createdAt: iso,
    },
    {
      id: uid("fin"),
      nature: "despesa" as const,
      description: "Tráfego pago — campanha de inverno",
      amount: 60000,
      dueDate: day(6),
      competence: monthKey,
      status: "liquidado" as const,
      settledAt: day(6),
      accountId: conta.id,
      categoryId: catDespesa.id,
      projectId: projeto.id,
      origin: "manual" as const,
      createdAt: iso,
    },
    {
      id: uid("fin"),
      nature: "despesa" as const,
      description: "Assinatura do banco de imagens",
      amount: 12900,
      dueDate: day(2),
      competence: monthKey,
      status: "pendente" as const,
      accountId: conta.id,
      origin: "manual" as const,
      createdAt: iso,
    },
  ];

  // Extrato para conciliar: uma já conferida, duas esperando
  const statementLines = [
    {
      id: uid("ext"),
      accountId: conta.id,
      key: `${conta.id}|${day(5)}|180000|pix recebido aurora`,
      date: day(5),
      description: "PIX RECEBIDO AURORA CAFE LTDA",
      amount: 180000,
      status: "conferida" as const,
      entryId: entries[0].id,
      settledEntry: true,
      reconciledAt: iso,
      createdAt: iso,
    },
    {
      id: uid("ext"),
      accountId: conta.id,
      key: `${conta.id}|${day(6)}|-60000|anuncios`,
      date: day(6),
      description: "PAGTO ANUNCIOS META PLATFORMS",
      amount: -60000,
      status: "a_conferir" as const,
      createdAt: iso,
    },
    {
      id: uid("ext"),
      accountId: conta.id,
      key: `${conta.id}|${day(6)}|-3990|tarifa`,
      date: day(6),
      description: "TARIFA PACOTE DE SERVICOS",
      amount: -3990,
      status: "a_conferir" as const,
      createdAt: iso,
    },
  ];

  // Integração de exemplo, desligada: ninguém dispara evento sem querer
  const webhooks = [
    {
      id: uid("hook"),
      url: "https://automacao.exemplo.com/orkestrya",
      events: ["post.aprovado" as const, "proposta.aceita" as const],
      secret: newSecret(),
      active: false,
      description: "Exemplo — avisar a planilha de produção",
      createdAt: iso,
      updatedAt: iso,
    },
  ];

  return {
    clients: [aurora, lumina, vitta],
    calendars: [auroraCal, luminaCal, vittaCal],
    posts,
    accounts: [conta],
    categories: [catReceita, catDespesa],
    entries,
    statementLines,
    squads: [squad],
    projects: [projeto, projetoAtrasado],
    dossierTemplates: [dossierTemplate],
    dossiers: [dossier],
    assessmentTemplates: [assessmentTemplate],
    assessments: [assessment],
    plans: [plan],
    pautaItems,
    ideas,
    scripts: [script],
    forms: [form],
    formResponses,
    deals,
    crmTasks,
    blocks,
    services,
    proposals,
    webhooks,
  };
}
