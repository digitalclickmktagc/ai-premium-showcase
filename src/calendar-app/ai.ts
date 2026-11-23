/**
 * Assistente de IA (benchmark ficha 22, com a crítica dela corrigida).
 *
 * A ficha descreve um assistente que "conhece só os guias, não os dados" — e
 * a própria avaliação crítica diz que isso vale pouco: o que entrega valor é
 * a IA enxergando os dados reais da agência. É esse o assistente aqui.
 *
 * Três regras moldam tudo neste arquivo:
 *
 *   • **A IA nunca grava sozinha.** Toda resposta é sugestão; quem aplica é
 *     uma pessoa, com um clique explícito. É a mesma ideia do "escrita
 *     desligada por padrão" da ficha, levada a sério.
 *   • **Vai o mínimo necessário, e dá para ver o que vai.** Cada ação declara
 *     que dados manda, o contexto é montado por função pura (testável) e
 *     passa por uma limpeza que remove e-mail, telefone, documento, token e
 *     segredo. A tela mostra o texto exato antes de enviar.
 *   • **Sem dado, sem resposta.** Quando falta base, a ação diz o que falta
 *     em vez de pedir à IA que invente.
 */

import type {
  Assessment,
  AssessmentTemplate,
  BriefingForm,
  Deal,
  Dossier,
  DossierTemplate,
  FinanceEntry,
  FormResponse,
  Interaction,
  MonthlyPlan,
  PautaItem,
  Post,
  Script,
} from "./types";

// ── Catálogo de ações ────────────────────────────────────────

export type AiActionId =
  | "resumo_do_dia"
  | "sugerir_pautas"
  | "escrever_legenda"
  | "rascunhar_roteiro"
  | "conclusoes_analise"
  | "explicar_financeiro"
  | "proximo_passo_crm"
  | "resumo_formulario";

/** O que a tela faz com a resposta. `null` = só leitura. */
export type AiApply = "texto" | "pautas" | "cenas" | null;

export interface AiAction {
  id: AiActionId;
  label: string;
  /** Uma frase sobre o que a ação faz. */
  what: string;
  /** O que é enviado para a IA — mostrado ao usuário antes de enviar. */
  sends: string;
  apply: AiApply;
}

export const AI_ACTIONS: AiAction[] = [
  {
    id: "resumo_do_dia",
    label: "Resumir meu dia",
    what: "Lê o que está pendente hoje e sugere por onde começar.",
    sends: "Títulos e datas do que está atrasado, aguardando cliente ou vencendo. Sem notas internas.",
    apply: null,
  },
  {
    id: "sugerir_pautas",
    label: "Sugerir pautas do mês",
    what: "Propõe pautas que respeitam os pilares e o funil do planejamento.",
    sends: "Pilares, foco de funil, objetivos do mês e os títulos já na pauta.",
    apply: "pautas",
  },
  {
    id: "escrever_legenda",
    label: "Escrever legenda",
    what: "Escreve uma legenda e etiquetas para este card.",
    sends: "Título, descrição e formato do card, mais tom e público do dossiê.",
    apply: "texto",
  },
  {
    id: "rascunhar_roteiro",
    label: "Rascunhar roteiro",
    what: "Monta cenas com fala, texto na tela e duração.",
    sends: "Título e descrição do card, formato e o tom do cliente.",
    apply: "cenas",
  },
  {
    id: "conclusoes_analise",
    label: "Escrever conclusões",
    what: "Lê as notas da análise e escreve o que fazer primeiro.",
    sends: "Notas por critério do cliente e dos concorrentes, sem contato de ninguém.",
    apply: "texto",
  },
  {
    id: "explicar_financeiro",
    label: "Explicar o mês",
    what: "Explica em palavras simples o resultado do mês.",
    sends: "Totais do mês, por natureza e por categoria. Sem nome de cliente.",
    apply: null,
  },
  {
    id: "proximo_passo_crm",
    label: "Sugerir próximo passo",
    what: "Sugere o próximo passo e um rascunho de mensagem.",
    sends: "Nome do negócio, etapa, valor e o histórico de interações. Sem telefone nem e-mail.",
    apply: "texto",
  },
  {
    id: "resumo_formulario",
    label: "Resumir respostas",
    what: "Resume o que as respostas do formulário dizem em comum.",
    sends: "Perguntas e respostas, sem o nome de quem respondeu.",
    apply: "texto",
  },
];

export function actionById(id: AiActionId): AiAction | undefined {
  return AI_ACTIONS.find((a) => a.id === id);
}

// ── Limpeza do que é enviado ─────────────────────────────────

/**
 * Campos que nunca saem daqui, qualquer que seja a ação. A comparação é por
 * palavra inteira (`share_token` e `shareToken` caem; `dias_sem_interacao`
 * não), porque uma busca por pedaço de palavra derrubaria campos legítimos.
 */
const FORBIDDEN_KEYS = new Set([
  "email",
  "emails",
  "mail",
  "phone",
  "telefone",
  "telefones",
  "celular",
  "whatsapp",
  "whats",
  "document",
  "documento",
  "cpf",
  "cnpj",
  "secret",
  "segredo",
  "token",
  "tokens",
  "apikey",
  "password",
  "senha",
  "sharetoken",
  "linkid",
  "contact",
  "contacts",
  "contato",
  "contatos",
  "internalnotes",
  "notasinternas",
]);

/** Quebra `shareToken`, `share_token` e `e-mail` nas palavras que os formam. */
function keyWords(key: string): string[] {
  const spaced = key.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2").toLowerCase();
  return spaced.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function isForbiddenKey(key: string): boolean {
  const words = keyWords(key);
  if (FORBIDDEN_KEYS.has(words.join(""))) return true;
  return words.some((w) => FORBIDDEN_KEYS.has(w));
}

const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const PHONE_RE = /(?:\+?\d{2}\s*)?(?:\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]?\d{4}/g;
const DOC_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

/** Tira de um texto o que é dado pessoal, deixando o resto legível. */
export function scrubText(text: string): string {
  return text
    .replace(EMAIL_RE, "[e-mail]")
    .replace(DOC_RE, "[documento]")
    .replace(PHONE_RE, "[telefone]");
}

/**
 * Remove de um objeto, em qualquer profundidade, os campos proibidos e os
 * dados pessoais que tenham escapado dentro de texto livre. É a última linha
 * antes de o conteúdo sair do navegador.
 */
export function scrub<T>(value: T): T {
  if (typeof value === "string") return scrubText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrub(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenKey(key)) continue;
      out[key] = scrub(inner);
    }
    return out as unknown as T;
  }
  return value;
}

// ── Contextos por ação ───────────────────────────────────────

export interface AiContext {
  /** Objeto que vai no corpo da mensagem, já limpo. */
  data: Record<string, unknown>;
  /** Por que a ação não pode rodar, quando não pode. */
  missing?: string;
}

const short = (text: string | undefined, max = 280) =>
  !text ? undefined : text.length <= max ? text : `${text.slice(0, max)}…`;

export function contextResumoDoDia(input: {
  today: string;
  late: Post[];
  waiting: Post[];
  dueToday: { description: string; amount: number; nature: string }[];
  overdue: { description: string; amount: number; nature: string }[];
  tasks: { title: string; dueOn: string }[];
  clientOf: (calendarId: string) => string;
}): AiContext {
  const total =
    input.late.length + input.waiting.length + input.dueToday.length +
    input.overdue.length + input.tasks.length;
  if (total === 0) return { data: {}, missing: "Não há nada pendente hoje para resumir." };
  return {
    data: scrub({
      hoje: input.today,
      posts_atrasados: input.late.slice(0, 20).map((p) => ({
        titulo: p.title,
        data: p.date,
        cliente: input.clientOf(p.calendarId),
      })),
      aguardando_cliente: input.waiting.slice(0, 20).map((p) => ({
        titulo: p.title,
        data: p.date,
        cliente: input.clientOf(p.calendarId),
      })),
      contas_vencidas: input.overdue.slice(0, 20).map((e) => ({
        descricao: e.description,
        valor_reais: e.amount / 100,
        tipo: e.nature,
      })),
      contas_de_hoje: input.dueToday.slice(0, 20).map((e) => ({
        descricao: e.description,
        valor_reais: e.amount / 100,
        tipo: e.nature,
      })),
      tarefas_comerciais: input.tasks.slice(0, 20),
    }),
  };
}

export function contextSugerirPautas(input: {
  clientName: string;
  month: string;
  plan?: MonthlyPlan;
  items: PautaItem[];
  dossier?: { sections: { titulo: string; conteudo: string }[] };
  quantity: number;
}): AiContext {
  if (!input.plan) {
    return {
      data: {},
      missing: "Abra o planejamento do mês primeiro: é dele que saem os pilares e o funil.",
    };
  }
  return {
    data: scrub({
      cliente: input.clientName,
      mes: input.month,
      quantas_sugestoes: input.quantity,
      pilares: input.plan.pillars.map((p) => ({ nome: p.name, fatia_percentual: p.share })),
      foco_do_funil: input.plan.funnel,
      objetivos: input.plan.objectives.map((o) => ({ objetivo: o.text, indicador: o.indicator })),
      metas: input.plan.goals.map((g) => ({ meta: g.name, alvo: g.target })),
      melhorias: input.plan.improvements,
      ja_na_pauta: input.items.map((i) => ({
        titulo: i.title,
        data: i.date,
        onde: i.kind,
        pilar: input.plan?.pillars.find((p) => p.id === i.pillarId)?.name,
      })),
      estrategia_do_cliente: input.dossier?.sections ?? [],
    }),
  };
}

export function contextLegenda(input: {
  post: Pick<Post, "title" | "description" | "contentType" | "date">;
  clientName: string;
  tone?: string;
  audience?: string;
}): AiContext {
  if (!input.post.title.trim()) {
    return { data: {}, missing: "Dê um título ao card antes de pedir a legenda." };
  }
  return {
    data: scrub({
      cliente: input.clientName,
      titulo: input.post.title,
      descricao: short(input.post.description, 800),
      formato: input.post.contentType,
      data: input.post.date,
      tom: input.tone,
      publico: input.audience,
    }),
  };
}

export function contextRoteiro(input: {
  post: Pick<Post, "title" | "description" | "contentType">;
  clientName: string;
  kind: Script["kind"];
  seconds: number;
  tone?: string;
}): AiContext {
  if (!input.post.title.trim()) {
    return { data: {}, missing: "Dê um título ao card antes de pedir o roteiro." };
  }
  return {
    data: scrub({
      cliente: input.clientName,
      titulo: input.post.title,
      descricao: short(input.post.description, 800),
      formato: input.post.contentType,
      tipo_de_roteiro: input.kind === "stories" ? "stories (telas 9:16)" : "vídeo",
      duracao_alvo_segundos: input.seconds,
      tom: input.tone,
    }),
  };
}

export function contextConclusoesAnalise(input: {
  assessment: Assessment;
  template: AssessmentTemplate;
  scores: { name: string; kind: string; score: number | null; band: string | null }[];
  gaps: { group: string; ours: number; theirs: number; leader: string }[];
}): AiContext {
  const rated = Object.values(input.assessment.scores).some(
    (s) => Object.keys(s).length > 0,
  );
  if (!rated) {
    return { data: {}, missing: "Dê pelo menos algumas notas antes de pedir as conclusões." };
  }
  return {
    data: scrub({
      titulo: input.assessment.title,
      criterios: input.template.questions.map((q) => ({
        grupo: q.group,
        criterio: q.label,
        peso: q.weight,
      })),
      notas: input.assessment.subjects.map((s) => ({
        perfil: s.name,
        papel: s.kind,
        seguidores: s.followers,
        frequencia: s.frequency,
        notas_por_criterio: input.assessment.scores[s.id] ?? {},
      })),
      placar: input.scores,
      onde_perdemos: input.gaps,
    }),
  };
}

export function contextFinanceiro(input: {
  month: string;
  entries: FinanceEntry[];
  categoryName: (id?: string) => string;
}): AiContext {
  const ofMonth = input.entries.filter((e) => e.competence === input.month);
  if (ofMonth.length === 0) {
    return { data: {}, missing: "Não há lançamento neste mês para explicar." };
  }
  const soma = (list: FinanceEntry[]) => list.reduce((s, e) => s + e.amount, 0) / 100;
  const receita = ofMonth.filter((e) => e.nature === "receita");
  const despesa = ofMonth.filter((e) => e.nature === "despesa");
  const porCategoria = new Map<string, number>();
  for (const e of despesa) {
    const key = input.categoryName(e.categoryId);
    porCategoria.set(key, (porCategoria.get(key) ?? 0) + e.amount / 100);
  }
  return {
    data: scrub({
      mes: input.month,
      receita_total_reais: soma(receita),
      receita_liquidada_reais: soma(receita.filter((e) => e.status === "liquidado")),
      despesa_total_reais: soma(despesa),
      despesa_liquidada_reais: soma(despesa.filter((e) => e.status === "liquidado")),
      em_aberto_reais: soma(ofMonth.filter((e) => e.status !== "liquidado")),
      vencidos: ofMonth.filter((e) => e.status !== "liquidado" && e.dueDate < input.month + "-32")
        .length,
      despesas_por_categoria: [...porCategoria.entries()].map(([categoria, valor]) => ({
        categoria,
        valor_reais: valor,
      })),
    }),
  };
}

export function contextProximoPasso(input: {
  deal: Deal;
  stageName: string;
  interactions: Interaction[];
  daysSinceContact: number | null;
}): AiContext {
  return {
    data: scrub({
      negocio: input.deal.name,
      empresa: input.deal.company,
      segmento: input.deal.segment,
      cidade: input.deal.city,
      origem: input.deal.origin,
      etapa: input.stageName,
      valor_mensal_reais: input.deal.recurringValue / 100,
      valor_unico_reais: input.deal.oneOffValue / 100,
      dias_sem_interacao: input.daysSinceContact,
      historico: input.interactions.slice(0, 15).map((i) => ({
        tipo: i.kind,
        quando: i.at.slice(0, 10),
        o_que_aconteceu: short(i.content, 400),
      })),
    }),
  };
}

export function contextResumoFormulario(input: {
  form: BriefingForm;
  responses: FormResponse[];
}): AiContext {
  const own = input.responses.filter((r) => r.formId === input.form.id);
  if (own.length === 0) {
    return { data: {}, missing: "Este formulário ainda não tem resposta para resumir." };
  }
  return {
    data: scrub({
      formulario: input.form.title,
      perguntas: input.form.questions.map((q) => ({ id: q.id, pergunta: q.label, tipo: q.kind })),
      respostas: own.map((r) => ({ quando: r.at.slice(0, 10), respostas: r.answers })),
    }),
  };
}

/** O dossiê em forma de texto curto, para dar contexto de marca às ações. */
export function dossierBrief(
  dossier: Dossier | undefined,
  template: DossierTemplate | undefined,
  limit = 6,
): { titulo: string; conteudo: string }[] {
  if (!dossier || !template) return [];
  const out: { titulo: string; conteudo: string }[] = [];
  for (const def of template.sections) {
    const section = dossier.sections.find((s) => s.sectionId === def.id);
    if (!section) continue;
    const parts = [
      section.text,
      ...Object.values(section.values ?? {}),
      ...(section.list ?? []),
    ].filter((v): v is string => !!v && v.trim().length > 0);
    if (parts.length === 0) continue;
    out.push({ titulo: def.title, conteudo: scrubText(parts.join(" · ").slice(0, 600)) });
    if (out.length >= limit) break;
  }
  return out;
}

// ── Resposta ─────────────────────────────────────────────────

export interface PautaSuggestion {
  titulo: string;
  data?: string;
  onde?: "post" | "story";
  formato?: string;
  pilar?: string;
  funil?: string;
  briefing?: string;
}

export interface SceneSuggestion {
  fala?: string;
  texto_na_tela?: string;
  plano?: string;
  segundos?: number;
}

/**
 * Lê o JSON que a IA devolveu, mesmo quando vem cercado de texto. Devolve
 * `null` em vez de lançar: resposta fora do formato é caso previsto, não
 * exceção.
 */
export function parseJsonBlock<T>(text: string): T | null {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1]);
  const firstBrace = trimmed.search(/[[{]/);
  const lastBrace = Math.max(trimmed.lastIndexOf("]"), trimmed.lastIndexOf("}"));
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

/** Normaliza as pautas sugeridas e descarta o que vier sem título. */
export function readPautaSuggestions(text: string): PautaSuggestion[] {
  const parsed = parseJsonBlock<{ pautas?: PautaSuggestion[] } | PautaSuggestion[]>(text);
  const list = Array.isArray(parsed) ? parsed : (parsed?.pautas ?? []);
  return list
    .filter((p) => typeof p?.titulo === "string" && p.titulo.trim().length > 0)
    .map((p) => ({
      titulo: p.titulo.trim(),
      data: typeof p.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.data) ? p.data : undefined,
      onde: p.onde === "story" ? "story" : "post",
      formato: typeof p.formato === "string" ? p.formato : undefined,
      pilar: typeof p.pilar === "string" ? p.pilar : undefined,
      funil: typeof p.funil === "string" ? p.funil : undefined,
      briefing: typeof p.briefing === "string" ? p.briefing : undefined,
    }));
}

export function readSceneSuggestions(text: string): SceneSuggestion[] {
  const parsed = parseJsonBlock<{ cenas?: SceneSuggestion[] } | SceneSuggestion[]>(text);
  const list = Array.isArray(parsed) ? parsed : (parsed?.cenas ?? []);
  return list
    .filter((c) => c && (c.fala || c.texto_na_tela))
    .slice(0, 60)
    .map((c) => ({
      fala: typeof c.fala === "string" ? c.fala : undefined,
      texto_na_tela: typeof c.texto_na_tela === "string" ? c.texto_na_tela : undefined,
      plano: typeof c.plano === "string" ? c.plano : undefined,
      segundos:
        typeof c.segundos === "number" && c.segundos > 0 && c.segundos <= 600
          ? Math.round(c.segundos)
          : undefined,
    }));
}

// ── Tamanho do que é enviado ─────────────────────────────────

/** Um palpite grosseiro de tokens, só para barrar envio absurdo. */
export function roughTokens(data: unknown): number {
  return Math.ceil(JSON.stringify(data ?? {}).length / 4);
}

export const MAX_CONTEXT_TOKENS = 60_000;

export function tooBig(data: unknown): boolean {
  return roughTokens(data) > MAX_CONTEXT_TOKENS;
}

// ── Instruções ───────────────────────────────────────────────

/**
 * A instrução de sistema. Vale para todas as ações: o que a IA é, o que não
 * pode fazer e como responder quando não sabe.
 */
export const SYSTEM_PROMPT = [
  "Você é o assistente de uma agência de social media brasileira. Fala português do Brasil,",
  "em frases curtas e diretas, sem jargão de marketing e sem enrolação.",
  "",
  "Regras:",
  "— Use só os dados que vierem na mensagem. Não invente número, data, nome ou resultado.",
  "— Se o dado não estiver ali, diga o que falta em vez de supor.",
  "— Você sugere; quem decide e publica é a equipe. Nunca escreva como se já tivesse feito algo.",
  "— Nada de prometer resultado ('vai bombar', 'garante X seguidores').",
  "— Quando pedirem JSON, responda só o JSON, sem texto antes ou depois.",
].join("\n");

const JSON_PAUTAS = [
  'Responda só com JSON neste formato: {"pautas":[{"titulo":"","data":"AAAA-MM-DD","onde":"post|story",',
  '"formato":"","pilar":"","funil":"descoberta|interesse|conversao|fidelizacao","briefing":""}]}.',
  "Use só pilares que existem na lista. Respeite a fatia de cada pilar e o foco de funil.",
  "Não repita o que já está na pauta. Datas dentro do mês pedido.",
].join(" ");

const JSON_CENAS = [
  'Responda só com JSON neste formato: {"cenas":[{"fala":"","texto_na_tela":"","plano":"","segundos":0}]}.',
  "A soma dos segundos deve ficar perto da duração alvo. Primeira cena é o gancho, última tem a chamada para ação.",
].join(" ");

/** A instrução específica de cada ação. */
export const TASK_PROMPTS: Record<AiActionId, string> = {
  resumo_do_dia: [
    "Resuma o dia da equipe em no máximo 6 linhas.",
    "Comece pelo que é mais urgente, diga quantos itens são de cada tipo e termine com uma frase",
    "dizendo por onde começar. Sem lista enorme: agrupe.",
  ].join(" "),
  sugerir_pautas: `Sugira pautas novas para o mês. ${JSON_PAUTAS}`,
  escrever_legenda: [
    "Escreva uma legenda para este conteúdo: um gancho na primeira linha, o corpo em 2 a 4 frases",
    "curtas, uma chamada para ação e, na última linha, de 3 a 6 hashtags.",
    "Responda só com a legenda, sem título nem explicação.",
  ].join(" "),
  rascunhar_roteiro: `Escreva o roteiro deste conteúdo. ${JSON_CENAS}`,
  conclusoes_analise: [
    "Escreva as conclusões desta análise de perfil em no máximo 10 linhas:",
    "onde o cliente está bem, onde está atrás dos concorrentes e as 3 primeiras ações a tomar,",
    "da mais fácil para a mais difícil. Cite a nota quando ela sustentar o que você diz.",
  ].join(" "),
  explicar_financeiro: [
    "Explique o mês para alguém que não entende de contabilidade, em no máximo 6 linhas:",
    "entrou quanto, saiu quanto, sobrou quanto, o que mais pesou e o que vigiar.",
    "Valores em reais, com R$ e duas casas.",
  ].join(" "),
  proximo_passo_crm: [
    "Diga em uma linha qual é o próximo passo com este cliente em potencial e por quê.",
    "Depois escreva, entre aspas, uma mensagem curta de WhatsApp para mandar agora —",
    "no máximo 4 linhas, sem 'espero que esteja bem'.",
  ].join(" "),
  resumo_formulario: [
    "Resuma o que as respostas dizem: os pontos em comum, as diferenças que chamam atenção",
    "e o que ficou sem resposta. No máximo 8 linhas.",
  ].join(" "),
};

export interface AiRequest {
  action: AiActionId;
  system: string;
  prompt: string;
  data: Record<string, unknown>;
}

/** Monta o pedido completo. Lança só se a ação não existir. */
export function buildRequest(action: AiActionId, context: AiContext): AiRequest {
  const task = TASK_PROMPTS[action];
  if (!task) throw new Error(`Ação desconhecida: ${action}`);
  return { action, system: SYSTEM_PROMPT, prompt: task, data: context.data };
}

/** O texto exato que será enviado — é isso que a tela mostra antes de mandar. */
export function previewRequest(request: AiRequest): string {
  return `${request.prompt}\n\n${JSON.stringify(request.data, null, 2)}`;
}
