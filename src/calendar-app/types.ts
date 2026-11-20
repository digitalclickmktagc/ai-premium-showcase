import type { AutomationRule, AutomationRun } from "./automation";

/**
 * Domain model for the editorial calendar app.
 *
 * Entities (per spec section 3):
 *  - Client            → an agency client, has visual identity (color/logo)
 *  - Calendar          → one editorial calendar per client, with a unique share token
 *  - Post              → a scheduled piece of content inside a calendar
 *
 * All dates that represent a "scheduled day" are stored as `YYYY-MM-DD`
 * (local calendar day, no timezone). Timestamps (createdAt/updatedAt) are
 * full ISO strings.
 */

/** Post lifecycle status. Values are stable identifiers persisted to storage. */
export type PostStatus =
  | "todo" // A Fazer
  | "done" // Feito
  | "published" // Publicado
  | "rescheduled" // Reagendado
  | "deleted"; // Deletado (soft delete)

/** A single reschedule event, kept as history on the post. */
export interface RescheduleEntry {
  /** Previous scheduled day (YYYY-MM-DD). */
  from: string;
  /** New scheduled day (YYYY-MM-DD). */
  to: string;
  /** When the reschedule happened (ISO timestamp). */
  at: string;
}

/** Outcome a client can record on a review round. */
export type ApprovalResult = "approved" | "changes" | "rejected";

/**
 * Derived review state. Per the spec this is computed from the decisions of
 * the current round and is never written by hand.
 */
export type ApprovalState =
  | "none" // never sent for review
  | "pending" // sent, awaiting the client
  | "approved"
  | "changes" // adjustments requested
  | "rejected";

export interface ApprovalDecision {
  id: string;
  /** Round this decision belongs to (1-based). */
  round: number;
  result: ApprovalResult;
  /** Mandatory for `changes` and `rejected` (1–2000 chars). */
  comment?: string;
  /** Name the decider typed. */
  decidedByName?: string;
  /** True when the decider proved control of the client's e-mail. */
  verified: boolean;
  at: string;
}

/** Review request attached to a post. */
export interface ApprovalRequest {
  /** Current round number; 0 means never sent. */
  round: number;
  requestedAt?: string;
  /** Message the team attached to the latest round. */
  teamMessage?: string;
  decisions: ApprovalDecision[];
}

/** Client lifecycle (Spec 01). `active` is kept as a derived mirror so older
 * stored records and existing screens keep working. */
export type ClientStatus = "active" | "paused" | "ended" | "archived";

export interface Client {
  id: string;
  name: string;
  /** Hex accent color used for the client's visual identity. */
  color: string;
  /** Optional logo image URL. */
  logoUrl?: string;
  /** Optional short handle / social @ shown in the client view. */
  handle?: string;
  /** Contact e-mail. Used to send the approval verification code. */
  email?: string;
  /** Lifecycle state. Source of truth; `active` mirrors it for compatibility. */
  status: ClientStatus;
  /** True when status is "active". Derived — do not set it directly. */
  active: boolean;
  /** Free-text segment (e.g. "Alimentação", "Saúde"). */
  segment?: string;
  /** Pinned clients sort to the top of the list. */
  pinned?: boolean;
  /** Client since (YYYY-MM-DD). */
  servedSince?: string;
  createdAt: string;
}

export interface Calendar {
  id: string;
  clientId: string;
  name: string;
  /** Unique, unguessable token used for the public client share link. */
  shareToken: string;
  createdAt: string;
}

/**
 * A column on a calendar's board (benchmark spec 02).
 *
 * Columns are per-calendar and optional: a calendar with none uses the four
 * standard stages, exactly as before. Each custom column declares the status
 * it stands for, and that status stays the invariant the rest of the system
 * reads — the client view, the approval automations and the health index all
 * keep working without knowing a thing about custom columns.
 */
export interface BoardStage {
  id: string;
  calendarId: string;
  name: string;
  /** Hex colour for the column dot and the card's left border. */
  color: string;
  /**
   * The standard status this column stands for.
   *
   * A stored column is never "deleted" — the database rejects it and the
   * editor does not offer it, because the bin is not a production stage. The
   * type stays wide so the board can describe the bin as a column too, using
   * the same shape as everything else it renders.
   */
  category: PostStatus;
  /** Position on the board, ascending. */
  order: number;
}

/** One line of a card's checklist. */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** Internal note on a card, written by the agency. Never leaves the agency. */
export interface PostComment {
  id: string;
  author: string;
  body: string;
  at: string;
}

/** A working file referenced by the card: a link, with a readable name. */
export interface PostAttachment {
  id: string;
  name: string;
  url: string;
  at: string;
}

/** Time logged against the card, in minutes. */
export interface TimeEntry {
  id: string;
  minutes: number;
  note?: string;
  at: string;
}

export interface Post {
  id: string;
  calendarId: string;
  title: string;
  /** Scheduled day (YYYY-MM-DD). */
  date: string;
  status: PostStatus;
  /** Long caption / description shown to the client. */
  description: string;
  /** Content format: feed, story, reels, carrossel or any custom value. */
  contentType?: string;
  /** Reference/attachment link (briefing, Drive, cover image, ...). */
  referenceLink?: string;
  /** Internal admin-only notes. NEVER exposed in the client view. */
  internalNotes?: string;
  /** Reschedule history (old date → new date). */
  rescheduleHistory: RescheduleEntry[];
  /** External review. Absent means the post was never sent to the client. */
  approval?: ApprovalRequest;
  /**
   * Production workspace (benchmark spec 02). All four are INTERNAL: like
   * `internalNotes`, none of them may ever reach the client's share view.
   */
  checklist?: ChecklistItem[];
  comments?: PostComment[];
  attachments?: PostAttachment[];
  timeEntries?: TimeEntry[];
  /** Idea this card came from, when it was created from the banco de ideias. */
  ideaId?: string;
  /** Project this card belongs to (ficha 14). */
  projectId?: string;
  /**
   * Custom column the card sits in, when the calendar defines its own.
   * `status` is still kept in step with that column's category, so nothing
   * that reads `status` has to know custom columns exist.
   */
  stageId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── CRM (benchmark spec 09) ──────────────────────────────────

export type DealPhase = "prospeccao" | "oportunidade";
export type DealStatus = "aberto" | "ganho" | "perdido";
export type StageKind = "aberta" | "ganho" | "perda";

export interface CrmStage {
  id: string;
  phase: DealPhase;
  name: string;
  order: number;
  kind: StageKind;
  /** 0–100; the odds the agency gives a deal sitting here. */
  defaultProbability: number;
  /** The stage cannot be entered without a proposal attached. */
  requiresProposal?: boolean;
}

export interface CrmContact {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  primary: boolean;
  /** Where the contact came from, and under which lawful basis (LGPD). */
  source?: string;
  collectedAt?: string;
  lawfulBasis?: string;
}

export type InteractionKind = "ligacao" | "mensagem" | "email" | "reuniao" | "nota";

/** Insert-only: a correction is a new interaction, never an edit. */
export interface Interaction {
  id: string;
  dealId: string;
  kind: InteractionKind;
  at: string;
  author?: string;
  content: string;
  /** Whether the other side answered. Drives the no-reply cadence. */
  answered?: boolean;
}

export interface CrmTask {
  id: string;
  dealId: string;
  title: string;
  dueOn: string;
  note?: string;
  doneAt?: string;
  result?: string;
}

export interface Deal {
  id: string;
  phase: DealPhase;
  stageId: string;
  name: string;
  company?: string;
  document?: string;
  segment?: string;
  city?: string;
  origin?: string;
  tags?: string[];
  /** Integer cents. */
  recurringValue: number;
  oneOffValue: number;
  /** Overrides the stage's default when set. */
  probability?: number;
  /** 0–100, from the qualification criteria. */
  score?: number;
  nextStepOn?: string;
  lastContactOn?: string;
  clientId?: string;
  proposalId?: string;
  status: DealStatus;
  lossReason?: string;
  contacts: CrmContact[];
  createdAt: string;
  updatedAt: string;
}

/** A contact that must never be approached again (LGPD, and manners). */
export interface ContactBlock {
  id: string;
  kind: "email" | "dominio" | "telefone";
  value: string;
  reason?: string;
  at: string;
}

// ── Orquestrador venda → operação (benchmark spec 10) ────────

export type SagaStepKey =
  | "resolver_cliente"
  | "gerar_contrato"
  | "aguardar_assinaturas"
  | "ativar_servicos"
  | "criar_financeiro"
  | "criar_quadro"
  | "criar_projeto"
  | "concluir";

export type SagaStepStatus = "pendente" | "feito" | "falhou" | "pulado";

export interface SagaStep {
  key: SagaStepKey;
  status: SagaStepStatus;
  attempts: number;
  /** Ids created by this step, so a retry can recognise its own work. */
  result?: Record<string, string>;
  detail?: string;
  at?: string;
}

export interface ContractingProcess {
  id: string;
  proposalId: string;
  dealId?: string;
  clientId?: string;
  status: "em_andamento" | "aguardando_assinatura" | "concluido" | "falhou" | "cancelado";
  steps: SagaStep[];
  startedAt: string;
  finishedAt?: string;
}

// ── Financeiro (benchmark spec 08) ───────────────────────────

export type EntryNature = "receita" | "despesa";
export type EntryStatus = "previsto" | "pendente" | "liquidado" | "cancelado";
export type AccountKind = "banco" | "caixa" | "carteira";
export type ExpenseKind = "fixa" | "variavel" | "imposto" | "pessoal";

export interface FinanceAccount {
  id: string;
  name: string;
  kind: AccountKind;
  /** Integer cents. */
  initialBalance: number;
  initialBalanceDate: string;
  color?: string;
  active: boolean;
  createdAt: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  nature: EntryNature;
  expenseKind?: ExpenseKind;
  /** Integer cents; 0 means no target. */
  monthlyTarget?: number;
  color?: string;
  active: boolean;
}

export type SeriesKind = "parcelada" | "recorrente";

export interface FinanceSeries {
  id: string;
  kind: SeriesKind;
  /** Months between charges: 1 monthly, 3 quarterly, 12 yearly. */
  everyMonths: number;
  /** Day of month the charge falls on (1–28, clamped). */
  dayOfMonth: number;
  /** Instalments, for a `parcelada` series. */
  count?: number;
  /** Integer cents: the whole for `parcelada`, one charge for `recorrente`. */
  totalAmount: number;
  startDate: string;
  /** Null for an open-ended recurring series. */
  endDate?: string;
  /** Months the agency chose to skip, as YYYY-MM. */
  skipped?: string[];
  nature: EntryNature;
  description: string;
  categoryId?: string;
  accountId?: string;
  clientId?: string;
  /** Cost centre carried into every charge the series projects. */
  projectId?: string;
  createdAt: string;
}

export interface FinanceEntry {
  id: string;
  nature: EntryNature;
  description: string;
  /** Integer cents, always positive; `nature` carries the sign. */
  amount: number;
  dueDate: string;
  /** Accounting month, YYYY-MM. */
  competence: string;
  status: EntryStatus;
  settledAt?: string;
  accountId?: string;
  categoryId?: string;
  clientId?: string;
  method?: string;
  document?: string;
  note?: string;
  seriesId?: string;
  /** Cost centre: the project this entry belongs to (ficha 14). */
  projectId?: string;
  /** 1-based position in a `parcelada` series. */
  seriesPosition?: number;
  origin: "manual" | "serie" | "contrato";
  /** Set on the mirror entry that reverses a settled one. */
  reversalOf?: string;
  createdAt: string;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

// ── Catálogo e propostas (benchmark spec 06) ─────────────────

/** How a service is charged. Recurring kinds normalise to a monthly figure. */
export type Billing =
  | "mensal"
  | "trimestral"
  | "semestral"
  | "anual"
  | "unica"
  | "por_hora";

export interface Service {
  id: string;
  name: string;
  category?: string;
  description?: string;
  /** What the client gets, one line each. */
  included?: string[];
  internalNote?: string;
  /** Integer cents. Never a float. */
  price: number;
  billing: Billing;
  executionDays?: number;
  active: boolean;
  /** Shown on the public price table. */
  publicInTable: boolean;
  order: number;
  color?: string;
  createdAt: string;
}

export type ProposalStatus =
  | "rascunho"
  | "enviada"
  | "ajuste_pedido"
  | "aceita"
  | "recusada"
  | "vencida"
  | "arquivada";

export interface ProposalItem {
  id: string;
  serviceId?: string;
  description: string;
  quantity: number;
  /** Integer cents. */
  unitPrice: number;
  billing: Billing;
  scope?: string;
}

export type PaymentMethod = "pix" | "boleto" | "cartao" | "transferencia";

export interface PaymentTerms {
  modality: "a_vista" | "parcelado";
  /** Integer cents paid up front. */
  entryAmount: number;
  installments: number;
  firstDueDate?: string;
  methods: PaymentMethod[];
}

/** Insert-only record of the client opening the proposal. */
export interface ProposalView {
  id: string;
  at: string;
  agent?: string;
}

export interface Proposal {
  id: string;
  /** AAAA-NNN, assigned when it is first sent. */
  number?: string;
  title: string;
  clientId?: string;
  /** Name to address when there is no client record yet. */
  leadName?: string;
  cover?: string;
  validUntil: string;
  minMonths?: number;
  conditions?: string;
  notes?: string;
  status: ProposalStatus;
  /** Token for the public page. */
  linkId: string;
  items: ProposalItem[];
  payment?: PaymentTerms;
  views: ProposalView[];
  sentAt?: string;
  decidedAt?: string;
  deciderName?: string;
  deciderDocument?: string;
  refusalReason?: string;
  /** Bumped on every re-send after a change request. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ── Contratos e assinatura (benchmark spec 07) ───────────────

export type ContractStatus =
  | "rascunho"
  | "gerado"
  | "aguardando_partes"
  | "parcialmente_assinado"
  | "vigente"
  | "encerrado"
  | "cancelado";

export type PartyRole = "contratante" | "contratada" | "testemunha";

export interface ContractParty {
  id: string;
  role: PartyRole;
  name: string;
  document?: string;
  email?: string;
  order: number;
  required: boolean;
  /** Token for this party's signing link. */
  token: string;
}

export interface Signature {
  id: string;
  partyId: string;
  typedName: string;
  typedDocument: string;
  at: string;
  agent?: string;
  /** Must equal the contract's textHash, or the contract cannot take effect. */
  signedTextHash: string;
}

export interface Contract {
  id: string;
  clientId?: string;
  proposalId?: string;
  title: string;
  status: ContractStatus;
  /** Frozen at generation. Immutable once anyone has signed. */
  finalText: string;
  /** SHA-256 of finalText. */
  textHash: string;
  startsOn?: string;
  endsOn?: string;
  autoRenew: boolean;
  renewNoticeDays: number;
  parties: ContractParty[];
  signatures: Signature[];
  createdAt: string;
  effectiveAt?: string;
}

// ── Agenda (benchmark spec 04) ───────────────────────────────

/** A meeting the agency keeps. The agenda's own entity. */
export interface Appointment {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  /** ISO datetime. */
  start: string;
  end: string;
  location?: string;
  status: "marcado" | "cancelado";
  /** Manual, or created by a public booking. */
  source: "manual" | "reserva";
  done?: boolean;
  createdAt: string;
}

/** A commemorative or holiday date worth seeing on the calendar. */
export interface MarkedDate {
  id: string;
  /** YYYY-MM-DD for the year it falls in. */
  date: string;
  name: string;
  category: string;
  color?: string;
  /**
   * Dates that need judgement before a brand posts about them (tragedies,
   * religious observances, political dates). Shown with a badge.
   */
  sensitive?: boolean;
  /** Absent for the built-in catalogue; set for dates the agency added. */
  custom?: boolean;
}

export interface AvailabilityWindow {
  /** HH:MM */
  start: string;
  end: string;
}

/** When the agency can be booked, and the shape of a booking. */
export interface Availability {
  /** Windows per weekday (0 = Sunday). */
  weekdays: Record<number, AvailabilityWindow[]>;
  durationMinutes: number;
  /** Hours of notice a visitor must give. */
  noticeHours: number;
  /** Buffer kept around every busy block. */
  gapMinutes: number;
}

/** The public booking page. Paused behaves exactly like missing. */
export interface BookingPage {
  linkId: string;
  active: boolean;
  title: string;
  intro?: string;
}

export interface Booking {
  id: string;
  pageId: string;
  name: string;
  email: string;
  start: string;
  end: string;
  status: "confirmada" | "cancelada";
  /** Lets the visitor cancel without an account. */
  manageToken: string;
  note?: string;
  createdAt: string;
}

/** Auth session. Clients access via token only, so sessions are admin-only. */
export interface Session {
  role: "admin";
  email: string;
  name: string;
}

/** A pending verification code for a link-based approval decision. */
export interface ApprovalCodeEntry {
  postId: string;
  /** Share token the code was issued for; binds the code to one calendar. */
  token: string;
  code: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

// ── Projetos e squads (ficha 14) ─────────────────────────────

export type ProjectStatus = "ativo" | "pausado" | "concluido" | "cancelado";

/**
 * A project groups a client's work with a deadline and a value, and doubles
 * as the cost centre the finance module reports by.
 */
export interface Project {
  id: string;
  name: string;
  clientId: string;
  squadId?: string;
  /** Service from the catalogue this project delivers, when it maps to one. */
  serviceId?: string;
  /** YYYY-MM-DD. */
  dueDate?: string;
  /** Integer cents. */
  value: number;
  status: ProjectStatus;
  color?: string;
  /** Contract that gave birth to the project, when the saga created it. */
  contractId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The weights of the squad's health score. They are data, and the screen
 * shows the arithmetic — the benchmark's own critique is that its score is
 * never explained to the person reading it.
 */
export interface HealthWeights {
  prazo: number;
  progresso: number;
  entrega: number;
}

export interface Squad {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  /** Names, not logins: this app has one account (see ficha 01/F00). */
  lead?: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Dossiê estratégico (ficha 16) ────────────────────────────

/** How one section of the dossier is filled in. */
export type DossierSectionKind = "texto" | "campos" | "lista" | "imagens" | "tabela";

/** Who may read a section. Internal sections never cross the public link. */
export type DossierVisibility = "cliente" | "interno";

export interface DossierFieldDef {
  id: string;
  label: string;
  hint?: string;
}

/**
 * One section of the agency's dossier model. The benchmark's own critique is
 * that its sections are fixed; here they are data the agency edits.
 */
export interface DossierSectionDef {
  id: string;
  title: string;
  kind: DossierSectionKind;
  /** For `campos`, the fields; for `tabela`, the columns. */
  fields?: DossierFieldDef[];
  hint?: string;
  defaultVisibility: DossierVisibility;
}

export interface DossierTemplate {
  id: string;
  name: string;
  sections: DossierSectionDef[];
  createdAt: string;
  updatedAt: string;
}

export interface DossierImage {
  id: string;
  url: string;
  caption?: string;
}

/** The content of one section for one client. */
export interface DossierSection {
  sectionId: string;
  visibility: DossierVisibility;
  text?: string;
  /** `campos`: field id → value. */
  values?: Record<string, string>;
  list?: string[];
  images?: DossierImage[];
  /** `tabela`: one object per row, keyed by column id. */
  rows?: Record<string, string>[];
}

export interface Dossier {
  id: string;
  clientId: string;
  templateId: string;
  sections: DossierSection[];
  /** Public read link. Absent until the agency generates one. */
  shareToken?: string;
  shareEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What the public strategy link serves. Internal sections are not here. */
export interface PublicDossier {
  client: { name: string; logoUrl?: string; color: string };
  template: { name: string; sections: DossierSectionDef[] };
  sections: DossierSection[];
}

// ── Pauta única e planejamento mensal (ficha 17, F17a) ───────

export type FunnelStage = "descoberta" | "interesse" | "conversao" | "fidelizacao";

/** A content pillar and the share of the month it should take. */
export interface Pillar {
  id: string;
  name: string;
  /** Percent, 0–100. The pillars of a plan add up to 100. */
  share: number;
}

export interface PlanGoal {
  id: string;
  name: string;
  target: string;
  /** What the same goal said last month, for comparison. */
  previous?: string;
}

export interface PlanObjective {
  id: string;
  text: string;
  indicator: string;
}

export interface PlanAction {
  id: string;
  title: string;
  startsOn?: string;
  endsOn?: string;
  /** Integer cents, like every other value in the app. */
  budget?: number;
  channel?: string;
  owner?: string;
}

export type PlanStatus = "rascunho" | "validado";

/** The month's plan for one client (planejamento mensal). */
export interface MonthlyPlan {
  id: string;
  clientId: string;
  /** YYYY-MM. */
  month: string;
  goals: PlanGoal[];
  objectives: PlanObjective[];
  improvements: string[];
  pillars: Pillar[];
  funnel: Record<FunnelStage, number>;
  actions: PlanAction[];
  closing?: string;
  status: PlanStatus;
  validatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PautaKind = "post" | "story";
export type PautaStatus = "ideia" | "pronta" | "convertida";

/**
 * One pauta item. This is the single planning entity the benchmark's own
 * critique asks for: the monthly plan, the internal plan and the stories
 * calendar are views of this, not three tables.
 */
export interface PautaItem {
  id: string;
  clientId: string;
  /** YYYY-MM-DD. */
  date: string;
  kind: PautaKind;
  title: string;
  channels: string[];
  format?: string;
  briefing?: string;
  caption?: string;
  pillarId?: string;
  funnel?: FunnelStage;
  owner?: string;
  status: PautaStatus;
  /** The card this item became, once it was converted. */
  postId?: string;
  calendarId?: string;
  /** Shared by every item of one weekly repetition. */
  seriesId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Banco de ideias de pauta (ficha 08). */
export type IdeaStatus = "nova" | "na_pauta" | "usada" | "arquivada";

/** An idea is either about one client or about nothing in particular. */
export type IdeaScope = { kind: "geral" } | { kind: "cliente"; clientId: string };

/** A card an idea produced. The post keeps the other half of the link. */
export interface IdeaUse {
  postId: string;
  calendarId: string;
  at: string;
}

export interface Idea {
  id: string;
  /** The line as typed, markers included. */
  text: string;
  scope: IdeaScope;
  /** Lowercased `#tags` read out of the text. */
  tags: string[];
  /** Lowercased `@mentions` read out of the text. */
  mentions: string[];
  /** Content format, when a tag named one (reels, carrossel, story...). */
  format?: string;
  status: IdeaStatus;
  /** One entry per person who voted. */
  votes: string[];
  usedBy: IdeaUse[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Full persisted database shape (used by the localStorage adapter). */
export interface Database {
  clients: Client[];
  calendars: Calendar[];
  posts: Post[];
  /** Short-lived approval codes. Never exposed through the public view. */
  approvalCodes?: ApprovalCodeEntry[];
  /** Custom board columns, scoped per calendar. Empty means "use the standard four". */
  boardStages?: BoardStage[];
  /**
   * CRM e orquestrador (specs 09 e 10). As etapas do funil são o conjunto
   * padrão calculado em crm.ts — editá-las não está construído.
   */
  deals?: Deal[];
  interactions?: Interaction[];
  crmTasks?: CrmTask[];
  blocks?: ContactBlock[];
  processes?: ContractingProcess[];
  /** Financeiro (spec 08). */
  accounts?: FinanceAccount[];
  categories?: FinanceCategory[];
  entries?: FinanceEntry[];
  series?: FinanceSeries[];
  transfers?: Transfer[];
  /** Catálogo, propostas e contratos (specs 06 e 07). */
  services?: Service[];
  proposals?: Proposal[];
  contracts?: Contract[];
  /** Agenda (spec 04). */
  appointments?: Appointment[];
  bookings?: Booking[];
  /** Marked dates the agency chose to keep on the calendar. */
  markedDates?: MarkedDate[];
  availability?: Availability;
  bookingPage?: BookingPage;
  /** Banco de ideias de pauta (ficha 08). */
  ideas?: Idea[];
  /** Pauta única e planejamento mensal (ficha 17). */
  plans?: MonthlyPlan[];
  pautaItems?: PautaItem[];
  /** Dossiê estratégico (ficha 16). */
  dossierTemplates?: DossierTemplate[];
  dossiers?: Dossier[];
  /** Projetos e squads (ficha 14). */
  projects?: Project[];
  squads?: Squad[];
  /** Weights of the squad health score, editable by the agency. */
  healthWeights?: HealthWeights;
  /** Stage automations, scoped per calendar. Admin-only. */
  automationRules?: AutomationRule[];
  /** Insert-only execution log for those automations. Admin-only. */
  automationRuns?: AutomationRun[];
}

/**
 * Sanitized calendar payload for the public (client) share view.
 * Deleted posts are excluded and every internal field — notes, checklist,
 * comments, attachments and logged time — is stripped from each post,
 * enforcing the isolation requirements from spec section 6.
 */
export type PublicPost = Omit<
  Post,
  | "internalNotes"
  | "checklist"
  | "comments"
  | "attachments"
  | "timeEntries"
  | "stageId"
  | "ideaId"
  | "projectId"
>;

export interface PublicCalendarView {
  calendar: Pick<Calendar, "id" | "name" | "shareToken">;
  client: Pick<Client, "id" | "name" | "color" | "logoUrl" | "handle"> & {
    /** Masked contact e-mail (e.g. "ab***@dominio.com") so the client knows
     * where the verification code goes. The full address is never exposed. */
    maskedEmail?: string;
  };
  posts: PublicPost[];
}

/** Input payloads. */
export interface CreateClientInput {
  name: string;
  color?: string;
  logoUrl?: string;
  handle?: string;
  /** Contact e-mail used for approval verification codes. */
  email?: string;
  status?: ClientStatus;
  segment?: string;
  active?: boolean;
  /** Optional override for the auto-created calendar name. */
  calendarName?: string;
}

export type UpdateClientInput = Partial<
  Pick<
    Client,
    | "name"
    | "color"
    | "logoUrl"
    | "handle"
    | "email"
    | "status"
    | "segment"
    | "pinned"
    | "servedSince"
  >
>;

export interface CreatePostInput {
  calendarId: string;
  title: string;
  date: string;
  status?: PostStatus;
  description?: string;
  contentType?: string;
  referenceLink?: string;
  internalNotes?: string;
  /** Set when the card was created from an idea in the banco de ideias. */
  ideaId?: string;
  projectId?: string;
}

export type UpdatePostInput = Partial<
  Pick<
    Post,
    | "title"
    | "date"
    | "status"
    | "description"
    | "contentType"
    | "referenceLink"
    | "internalNotes"
    | "checklist"
    | "comments"
    | "attachments"
    | "timeEntries"
    | "stageId"
    | "projectId"
  >
>;
