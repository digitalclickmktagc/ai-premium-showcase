/*
 * Supabase adapter — production data layer.
 *
 * Implemented with plain `fetch` against Supabase's REST (PostgREST) and Auth
 * (GoTrue) HTTP APIs, so it needs NO extra npm dependency (keeps the existing
 * build/lockfile untouched).
 *
 * Enabled automatically when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set
 * (see services/index.ts). Requires supabase/schema.sql to have been run and an
 * admin user to exist in Supabase Auth. Isolation is enforced server-side by
 * RLS; anonymous clients can only call get_public_calendar(token).
 */
import type {
  Appointment,
  ApprovalResult,
  ContactBlock,
  Contract,
  ContractingProcess,
  CrmTask,
  Assessment,
  AssessmentTemplate,
  BriefingForm,
  Dossier,
  DossierTemplate,
  FormResponse,
  AiSettings,
  HealthWeights,
  Idea,
  MonthlyPlan,
  PautaItem,
  Project,
  StatementLine,
  PublicDossier,
  PublicForm,
  Script,
  WebhookDelivery,
  WebhookSubscription,
  Squad,
  Deal,
  Interaction,
  FinanceAccount,
  FinanceCategory,
  FinanceEntry,
  FinanceSeries,
  Transfer,
  Proposal,
  ProposalStatus,
  Service,
  Availability,
  BoardStage,
  BookingPage,
  MarkedDate,
  Calendar,
  Client,
  CreateClientInput,
  CreatePostInput,
  Database,
  Post,
  PostStatus,
  PublicCalendarView,
  Session,
  UpdateClientInput,
  UpdatePostInput,
} from "../types";
import { shareToken } from "../utils";
import { validateDecision } from "../approval";
import { validateAppointment, validateBooking } from "../agenda";
import { validateProposal, validateService } from "../proposals";
import { validateDeal, validateInteraction } from "../crm";
import {
  buildReversal,
  dueForMaterialisation,
  validateEntry,
  validateSeries,
  validateTransfer,
} from "../finance";
import { validateSignature } from "../contracts";
import {
  validateRule,
  type AutomationRule,
  type AutomationRun,
} from "../automation";
import type { DataService } from "./DataService";

const SB_SESSION_KEY = "editorial-calendar:sb-session:v1";

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  email: string;
  name: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toClient = (r: any): Client => ({
  id: r.id,
  name: r.name,
  color: r.color,
  logoUrl: r.logo_url ?? undefined,
  handle: r.handle ?? undefined,
  email: r.email ?? undefined,
  status: (r.status ?? (r.active === false ? "paused" : "active")) as Client["status"],
  active: (r.status ?? (r.active === false ? "paused" : "active")) === "active",
  segment: r.segment ?? undefined,
  pinned: r.pinned ?? false,
  servedSince: r.served_since ?? undefined,
  createdAt: r.created_at,
});
const toCalendar = (r: any): Calendar => ({
  id: r.id,
  clientId: r.client_id,
  name: r.name,
  shareToken: r.share_token,
  createdAt: r.created_at,
});
const toPost = (r: any): Post => ({
  id: r.id,
  calendarId: r.calendar_id,
  title: r.title,
  date: r.date,
  status: r.status,
  description: r.description ?? "",
  contentType: r.content_type ?? undefined,
  referenceLink: r.reference_link ?? undefined,
  internalNotes: r.internal_notes ?? undefined,
  rescheduleHistory: r.reschedule_history ?? [],
  approval: r.approval ?? undefined,
  checklist: r.checklist ?? undefined,
  comments: r.comments ?? undefined,
  attachments: r.attachments ?? undefined,
  timeEntries: r.time_entries ?? undefined,
  stageId: r.stage_id ?? undefined,
  ideaId: r.idea_id ?? undefined,
  projectId: r.project_id ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toStage = (r: any): BoardStage => ({
  id: r.id,
  calendarId: r.calendar_id,
  name: r.name,
  color: r.color,
  category: r.category,
  order: r.position,
});
const toDeal = (r: any): Deal => ({
  id: r.id,
  phase: r.phase,
  stageId: r.stage_id,
  name: r.name,
  company: r.company ?? undefined,
  document: r.document ?? undefined,
  segment: r.segment ?? undefined,
  city: r.city ?? undefined,
  origin: r.origin ?? undefined,
  tags: r.tags ?? undefined,
  recurringValue: r.recurring_cents ?? 0,
  oneOffValue: r.one_off_cents ?? 0,
  probability: r.probability ?? undefined,
  score: r.score ?? undefined,
  nextStepOn: r.next_step_on ?? undefined,
  lastContactOn: r.last_contact_on ?? undefined,
  clientId: r.client_id ?? undefined,
  proposalId: r.proposal_id ?? undefined,
  status: r.status,
  lossReason: r.loss_reason ?? undefined,
  contacts: r.contacts ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const dealRow = (d: Deal) => ({
  id: d.id,
  phase: d.phase,
  stage_id: d.stageId,
  name: d.name.trim(),
  company: d.company ?? null,
  document: d.document ?? null,
  segment: d.segment ?? null,
  city: d.city ?? null,
  origin: d.origin ?? null,
  tags: d.tags ?? [],
  recurring_cents: d.recurringValue,
  one_off_cents: d.oneOffValue,
  probability: d.probability ?? null,
  score: d.score ?? null,
  next_step_on: d.nextStepOn ?? null,
  last_contact_on: d.lastContactOn ?? null,
  client_id: d.clientId ?? null,
  proposal_id: d.proposalId ?? null,
  status: d.status,
  loss_reason: d.lossReason ?? null,
  contacts: d.contacts,
});
const toInteraction = (r: any): Interaction => ({
  id: r.id,
  dealId: r.deal_id,
  kind: r.kind,
  at: r.at,
  author: r.author ?? undefined,
  content: r.content,
  answered: r.answered ?? undefined,
});
const toAssessmentTemplate = (r: any): AssessmentTemplate => ({
  id: r.id,
  name: r.name,
  questions: r.questions ?? [],
  bands: r.bands ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toAssessment = (r: any): Assessment => ({
  id: r.id,
  clientId: r.client_id,
  templateId: r.template_id,
  title: r.title,
  subjects: r.subjects ?? [],
  scores: r.scores ?? {},
  conclusions: r.conclusions ?? undefined,
  status: r.status,
  concludedAt: r.concluded_at ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toWebhook = (r: any): WebhookSubscription => ({
  id: r.id,
  url: r.url,
  events: r.events ?? [],
  secret: r.secret,
  active: r.active,
  description: r.description ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toWebhookDelivery = (r: any): WebhookDelivery => ({
  id: r.id,
  subscriptionId: r.subscription_id,
  event: r.event,
  payload: r.payload ?? {},
  status: r.status,
  attempts: r.attempts ?? 0,
  nextAttemptAt: r.next_attempt_at ?? undefined,
  responseStatus: r.response_status ?? undefined,
  error: r.error ?? undefined,
  deliveredAt: r.delivered_at ?? undefined,
  createdAt: r.created_at,
});
const toScript = (r: any): Script => ({
  id: r.id,
  postId: r.post_id,
  kind: r.kind,
  title: r.title,
  goal: r.goal ?? undefined,
  audience: r.audience ?? undefined,
  tone: r.tone ?? undefined,
  cta: r.cta ?? undefined,
  hashtags: r.hashtags ?? undefined,
  caption: r.caption ?? undefined,
  scenes: r.scenes ?? [],
  fields: r.fields ?? [],
  status: r.status,
  version: r.version ?? 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toForm = (r: any): BriefingForm => ({
  id: r.id,
  title: r.title,
  description: r.description ?? undefined,
  clientId: r.client_id ?? undefined,
  questions: r.questions ?? [],
  status: r.status,
  shareToken: r.share_token,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toFormResponse = (r: any): FormResponse => ({
  id: r.id,
  formId: r.form_id,
  answers: r.answers ?? {},
  respondent: r.respondent ?? undefined,
  at: r.at,
});
const toStatementLine = (r: any): StatementLine => ({
  id: r.id,
  accountId: r.account_id,
  key: r.key,
  date: r.date,
  description: r.description ?? "",
  amount: Number(r.amount_cents),
  status: r.status,
  entryId: r.entry_id ?? undefined,
  settledEntry: r.settled_entry ?? undefined,
  reconciledAt: r.reconciled_at ?? undefined,
  createdAt: r.created_at,
});
const toProject = (r: any): Project => ({
  id: r.id,
  name: r.name,
  clientId: r.client_id,
  squadId: r.squad_id ?? undefined,
  serviceId: r.service_id ?? undefined,
  dueDate: r.due_date ?? undefined,
  value: Number(r.value_cents ?? 0),
  status: r.status,
  color: r.color ?? undefined,
  contractId: r.contract_id ?? undefined,
  notes: r.notes ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toSquad = (r: any): Squad => ({
  id: r.id,
  name: r.name,
  description: r.description ?? undefined,
  color: r.color ?? undefined,
  icon: r.icon ?? undefined,
  lead: r.lead ?? undefined,
  members: r.members ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toDossierTemplate = (r: any): DossierTemplate => ({
  id: r.id,
  name: r.name,
  sections: r.sections ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toDossier = (r: any): Dossier => ({
  id: r.id,
  clientId: r.client_id,
  templateId: r.template_id,
  sections: r.sections ?? [],
  shareToken: r.share_token ?? undefined,
  shareEnabled: r.share_enabled ?? false,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toPlan = (r: any): MonthlyPlan => ({
  id: r.id,
  clientId: r.client_id,
  month: r.month,
  goals: r.goals ?? [],
  objectives: r.objectives ?? [],
  improvements: r.improvements ?? [],
  pillars: r.pillars ?? [],
  funnel: r.funnel ?? { descoberta: 0, interesse: 0, conversao: 0, fidelizacao: 0 },
  actions: r.actions ?? [],
  closing: r.closing ?? undefined,
  status: r.status,
  validatedAt: r.validated_at ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toPautaItem = (r: any): PautaItem => ({
  id: r.id,
  clientId: r.client_id,
  date: r.date,
  kind: r.kind,
  title: r.title,
  channels: r.channels ?? [],
  format: r.format ?? undefined,
  briefing: r.briefing ?? undefined,
  caption: r.caption ?? undefined,
  pillarId: r.pillar_id ?? undefined,
  funnel: r.funnel ?? undefined,
  owner: r.owner ?? undefined,
  status: r.status,
  postId: r.post_id ?? undefined,
  calendarId: r.calendar_id ?? undefined,
  seriesId: r.series_id ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toIdea = (r: any): Idea => ({
  id: r.id,
  text: r.text,
  scope: r.client_id ? { kind: "cliente", clientId: r.client_id } : { kind: "geral" },
  tags: r.tags ?? [],
  mentions: r.mentions ?? [],
  format: r.format ?? undefined,
  status: r.status,
  votes: r.votes ?? [],
  usedBy: (r.used_by ?? []).map((u: any) => ({
    postId: u.postId,
    calendarId: u.calendarId,
    at: u.at,
  })),
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toCrmTask = (r: any): CrmTask => ({
  id: r.id,
  dealId: r.deal_id,
  title: r.title,
  dueOn: r.due_on,
  note: r.note ?? undefined,
  doneAt: r.done_at ?? undefined,
  result: r.result ?? undefined,
});
const toBlock = (r: any): ContactBlock => ({
  id: r.id,
  kind: r.kind,
  value: r.value,
  reason: r.reason ?? undefined,
  at: r.at,
});
const toProcess = (r: any): ContractingProcess => ({
  id: r.id,
  proposalId: r.proposal_id,
  dealId: r.deal_id ?? undefined,
  clientId: r.client_id ?? undefined,
  status: r.status,
  steps: r.steps ?? [],
  startedAt: r.started_at,
  finishedAt: r.finished_at ?? undefined,
});
const toAccount = (r: any): FinanceAccount => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  initialBalance: r.initial_balance_cents,
  initialBalanceDate: r.initial_balance_date,
  color: r.color ?? undefined,
  active: r.active !== false,
  createdAt: r.created_at,
});
const accountRow = (a: FinanceAccount) => ({
  id: a.id,
  name: a.name.trim(),
  kind: a.kind,
  initial_balance_cents: a.initialBalance,
  initial_balance_date: a.initialBalanceDate,
  color: a.color ?? null,
  active: a.active,
});
const toCategory = (r: any): FinanceCategory => ({
  id: r.id,
  name: r.name,
  nature: r.nature,
  expenseKind: r.expense_kind ?? undefined,
  monthlyTarget: r.monthly_target_cents ?? undefined,
  color: r.color ?? undefined,
  active: r.active !== false,
});
const categoryRow = (c: FinanceCategory) => ({
  id: c.id,
  name: c.name.trim(),
  nature: c.nature,
  expense_kind: c.expenseKind ?? null,
  monthly_target_cents: c.monthlyTarget ?? null,
  color: c.color ?? null,
  active: c.active,
});
const toEntry = (r: any): FinanceEntry => ({
  id: r.id,
  nature: r.nature,
  description: r.description,
  amount: r.amount_cents,
  dueDate: r.due_date,
  competence: r.competence,
  status: r.status,
  settledAt: r.settled_at ?? undefined,
  accountId: r.account_id ?? undefined,
  categoryId: r.category_id ?? undefined,
  clientId: r.client_id ?? undefined,
  projectId: r.project_id ?? undefined,
  method: r.method ?? undefined,
  document: r.document ?? undefined,
  note: r.note ?? undefined,
  seriesId: r.series_id ?? undefined,
  seriesPosition: r.series_position ?? undefined,
  origin: r.origin,
  reversalOf: r.reversal_of ?? undefined,
  createdAt: r.created_at,
});
const entryRow = (e: FinanceEntry) => ({
  id: e.id,
  nature: e.nature,
  description: e.description.trim(),
  amount_cents: e.amount,
  due_date: e.dueDate,
  competence: e.competence,
  status: e.status,
  settled_at: e.settledAt ?? null,
  account_id: e.accountId ?? null,
  category_id: e.categoryId ?? null,
  client_id: e.clientId ?? null,
  project_id: e.projectId ?? null,
  method: e.method ?? null,
  document: e.document ?? null,
  note: e.note ?? null,
  series_id: e.seriesId ?? null,
  series_position: e.seriesPosition ?? null,
  origin: e.origin,
  reversal_of: e.reversalOf ?? null,
});
const toSeries = (r: any): FinanceSeries => ({
  id: r.id,
  kind: r.kind,
  everyMonths: r.every_months,
  dayOfMonth: r.day_of_month,
  count: r.count ?? undefined,
  totalAmount: r.total_cents,
  startDate: r.start_date,
  endDate: r.end_date ?? undefined,
  skipped: r.skipped ?? undefined,
  nature: r.nature,
  description: r.description,
  categoryId: r.category_id ?? undefined,
  accountId: r.account_id ?? undefined,
  clientId: r.client_id ?? undefined,
  projectId: r.project_id ?? undefined,
  createdAt: r.created_at,
});
const seriesRow = (s: FinanceSeries) => ({
  id: s.id,
  kind: s.kind,
  every_months: s.everyMonths,
  day_of_month: s.dayOfMonth,
  count: s.count ?? null,
  total_cents: s.totalAmount,
  start_date: s.startDate,
  end_date: s.endDate ?? null,
  skipped: s.skipped ?? [],
  nature: s.nature,
  description: s.description.trim(),
  category_id: s.categoryId ?? null,
  account_id: s.accountId ?? null,
  client_id: s.clientId ?? null,
  project_id: s.projectId ?? null,
});
const toTransfer = (r: any): Transfer => ({
  id: r.id,
  fromAccountId: r.from_account_id,
  toAccountId: r.to_account_id,
  amount: r.amount_cents,
  date: r.date,
  note: r.note ?? undefined,
  createdAt: r.created_at,
});
const toService = (r: any): Service => ({
  id: r.id,
  name: r.name,
  category: r.category ?? undefined,
  description: r.description ?? undefined,
  included: r.included ?? undefined,
  internalNote: r.internal_note ?? undefined,
  price: r.price_cents,
  billing: r.billing,
  executionDays: r.execution_days ?? undefined,
  active: r.active !== false,
  publicInTable: r.public_in_table === true,
  order: r.position ?? 0,
  color: r.color ?? undefined,
  createdAt: r.created_at,
});
const serviceRow = (s: Partial<Service>) => {
  const row: any = {};
  if (s.name !== undefined) row.name = s.name.trim();
  if (s.category !== undefined) row.category = s.category || null;
  if (s.description !== undefined) row.description = s.description || null;
  if (s.included !== undefined) row.included = s.included ?? [];
  if (s.internalNote !== undefined) row.internal_note = s.internalNote || null;
  if (s.price !== undefined) row.price_cents = s.price;
  if (s.billing !== undefined) row.billing = s.billing;
  if (s.executionDays !== undefined) row.execution_days = s.executionDays ?? null;
  if (s.active !== undefined) row.active = s.active;
  if (s.publicInTable !== undefined) row.public_in_table = s.publicInTable;
  if (s.order !== undefined) row.position = s.order;
  if (s.color !== undefined) row.color = s.color || null;
  return row;
};
const toProposal = (r: any): Proposal => ({
  id: r.id,
  number: r.number ?? undefined,
  title: r.title,
  clientId: r.client_id ?? undefined,
  leadName: r.lead_name ?? undefined,
  cover: r.cover ?? undefined,
  validUntil: r.valid_until,
  minMonths: r.min_months ?? undefined,
  conditions: r.conditions ?? undefined,
  notes: r.notes ?? undefined,
  status: r.status,
  linkId: r.link_id,
  items: r.items ?? [],
  payment: r.payment ?? undefined,
  views: r.views ?? [],
  sentAt: r.sent_at ?? undefined,
  decidedAt: r.decided_at ?? undefined,
  deciderName: r.decider_name ?? undefined,
  deciderDocument: r.decider_document ?? undefined,
  refusalReason: r.refusal_reason ?? undefined,
  version: r.version ?? 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const proposalRow = (p: Proposal) => ({
  id: p.id,
  number: p.number ?? null,
  title: p.title.trim(),
  client_id: p.clientId ?? null,
  lead_name: p.leadName ?? null,
  cover: p.cover ?? null,
  valid_until: p.validUntil,
  min_months: p.minMonths ?? null,
  conditions: p.conditions ?? null,
  notes: p.notes ?? null,
  status: p.status,
  link_id: p.linkId,
  items: p.items,
  payment: p.payment ?? null,
  views: p.views,
  sent_at: p.sentAt ?? null,
  decided_at: p.decidedAt ?? null,
  decider_name: p.deciderName ?? null,
  decider_document: p.deciderDocument ?? null,
  refusal_reason: p.refusalReason ?? null,
  version: p.version,
});
const toContract = (r: any): Contract => ({
  id: r.id,
  clientId: r.client_id ?? undefined,
  proposalId: r.proposal_id ?? undefined,
  title: r.title,
  status: r.status,
  finalText: r.final_text,
  textHash: r.text_hash,
  startsOn: r.starts_on ?? undefined,
  endsOn: r.ends_on ?? undefined,
  autoRenew: r.auto_renew === true,
  renewNoticeDays: r.renew_notice_days ?? 30,
  parties: r.parties ?? [],
  signatures: r.signatures ?? [],
  createdAt: r.created_at,
  effectiveAt: r.effective_at ?? undefined,
});
const contractRow = (c: Contract) => ({
  id: c.id,
  client_id: c.clientId ?? null,
  proposal_id: c.proposalId ?? null,
  title: c.title,
  status: c.status,
  final_text: c.finalText,
  text_hash: c.textHash,
  starts_on: c.startsOn ?? null,
  ends_on: c.endsOn ?? null,
  auto_renew: c.autoRenew,
  renew_notice_days: c.renewNoticeDays,
  parties: c.parties,
  signatures: c.signatures,
  effective_at: c.effectiveAt ?? null,
});
const toAppointment = (r: any): Appointment => ({
  id: r.id,
  clientId: r.client_id ?? undefined,
  title: r.title,
  description: r.description ?? undefined,
  start: r.starts_at,
  end: r.ends_at,
  location: r.location ?? undefined,
  status: r.status,
  source: r.source,
  done: r.done ?? false,
  createdAt: r.created_at,
});
const toBooking = (r: any) => ({
  id: r.id,
  pageId: r.page_id ?? "",
  name: r.name,
  email: r.email,
  start: r.starts_at,
  end: r.ends_at,
  status: r.status,
  manageToken: r.manage_token,
  note: r.note ?? undefined,
  createdAt: r.created_at,
});
const toMarkedDate = (r: any): MarkedDate => ({
  id: r.id,
  date: r.date,
  name: r.name,
  category: r.category,
  color: r.color ?? undefined,
  sensitive: r.sensitive ?? false,
  custom: r.custom ?? false,
});
const toRule = (r: any): AutomationRule => ({
  id: r.id,
  calendarId: r.calendar_id,
  trigger: r.trigger,
  action: r.action,
  active: r.active !== false,
  createdAt: r.created_at,
});
const toRun = (r: any): AutomationRun => ({
  id: r.id,
  ruleId: r.rule_id,
  postId: r.post_id,
  at: r.at,
  result: r.result,
  detail: r.detail ?? undefined,
  eventKey: r.event_key ?? undefined,
});
// Note: no-explicit-any stays disabled below — this adapter is the boundary
// that maps Supabase's untyped JSON rows to the domain model.

export class SupabaseService implements DataService {
  readonly name = "supabase";
  private base: string;
  private anonKey: string;
  private session: StoredSession | null = null;

  constructor(url: string, anonKey: string) {
    // Normalize: strip trailing slash and an accidental /rest/v1 suffix.
    this.base = url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
    this.anonKey = anonKey.trim();
    this.session = this.readStored();
  }

  // ── storage helpers ───────────────────────────────────────────
  private readStored(): StoredSession | null {
    try {
      const raw = localStorage.getItem(SB_SESSION_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  }
  private writeStored(s: StoredSession | null) {
    try {
      if (s) localStorage.setItem(SB_SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SB_SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  private toSession(s: StoredSession | null): Session | null {
    return s ? { role: "admin", email: s.email, name: s.name } : null;
  }

  // ── HTTP helpers ──────────────────────────────────────────────
  private headers(useUser: boolean): Record<string, string> {
    const token = useUser && this.session ? this.session.access_token : this.anonKey;
    return {
      apikey: this.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * fetch wrapper that turns a network-level failure ("Failed to fetch" —
   * offline, DNS, CORS, Supabase unreachable) into a message the operator can
   * act on, instead of a raw browser string.
   */
  private async http(input: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(input, init);
    } catch {
      throw new Error(
        "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.",
      );
    }
  }

  private async rest<T>(
    path: string,
    init: RequestInit & { useUser?: boolean } = {},
  ): Promise<T> {
    const { useUser = true, headers, ...rest } = init;
    const res = await this.http(`${this.base}/rest/v1/${path}`, {
      ...rest,
      headers: { ...this.headers(useUser), ...(headers as Record<string, string>) },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(this.friendlyError(res.status, body));
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private friendlyError(status: number, body: string): string {
    if (status === 401 || status === 403)
      return "Sessão expirada ou sem permissão. Faça login novamente.";
    try {
      const j = JSON.parse(body);
      return j.message || j.msg || j.error_description || j.error || body || `Erro ${status}`;
    } catch {
      return body || `Erro ${status}`;
    }
  }

  // ── Auth ──────────────────────────────────────────────────────
  getSession(): Session | null {
    return this.toSession(this.session);
  }

  /** Used only to call Edge Functions as the signed-in admin. */
  accessToken(): string | null {
    return this.session?.access_token ?? null;
  }

  async initSession(): Promise<Session | null> {
    if (!this.session) return null;
    // Refresh if the access token is expired (60s skew).
    if (this.session.expires_at && this.session.expires_at * 1000 < Date.now() + 60_000) {
      try {
        await this.refresh();
      } catch {
        this.session = null;
        this.writeStored(null);
      }
    }
    return this.toSession(this.session);
  }

  private storeFromTokenResponse(data: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    expires_in?: number;
    user?: any;
  }) {
    const email = data.user?.email ?? this.session?.email ?? "";
    this.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at:
        data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
      email,
      name: data.user?.user_metadata?.name ?? email ?? "Administrador",
    };
    this.writeStored(this.session);
  }

  async login(email: string, password: string): Promise<Session> {
    const res = await this.http(`${this.base}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: this.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data.error_description || data.msg || data.error || "E-mail ou senha inválidos.";
      throw new Error(msg);
    }
    this.storeFromTokenResponse(data);
    return this.toSession(this.session)!;
  }

  private async refresh(): Promise<void> {
    if (!this.session) throw new Error("Sem sessão para renovar.");
    const res = await this.http(`${this.base}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: this.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: this.session.refresh_token }),
    });
    if (!res.ok) throw new Error("Falha ao renovar a sessão.");
    this.storeFromTokenResponse(await res.json());
  }

  logout(): void {
    const token = this.session?.access_token;
    this.session = null;
    this.writeStored(null);
    if (token) {
      // best-effort server-side revoke
      void fetch(`${this.base}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: this.anonKey, Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
  }

  // ── Reads ─────────────────────────────────────────────────────
  async getDatabase(): Promise<Database> {
    if (!this.session)
      return {
        clients: [],
        calendars: [],
        posts: [],
        boardStages: [],
        automationRules: [],
        appointments: [],
        bookings: [],
        markedDates: [],
        services: [],
        proposals: [],
        contracts: [],
        accounts: [],
        categories: [],
        entries: [],
        series: [],
        transfers: [],
        deals: [],
        interactions: [],
        crmTasks: [],
        ideas: [],
        plans: [],
        pautaItems: [],
        dossierTemplates: [],
        dossiers: [],
        projects: [],
        squads: [],
        statementLines: [],
        scripts: [],
        assessmentTemplates: [],
        assessments: [],
        webhooks: [],
        webhookDeliveries: [],
        forms: [],
        formResponses: [],
        blocks: [],
        processes: [],
      };
    const [
      clients,
      calendars,
      posts,
      stages,
      rules,
      appointments,
      bookings,
      marked,
      cfg,
      services,
      proposals,
      contracts,
      accounts,
      categories,
      entries,
      finSeries,
      transfers,
      deals,
      interactions,
      crmTasks,
      ideas,
      plans,
      pautaRows,
      dossierTemplates,
      dossiers,
      projects,
      squads,
      statementLines,
      scripts,
      assessmentTemplates,
      assessments,
      webhooks,
      webhookDeliveries,
      forms,
      formResponses,
      agencySettings,
      aiSettings,
      blocks,
      processes,
    ] = await Promise.all([
        this.rest<any[]>("clients?select=*"),
        this.rest<any[]>("calendars?select=*"),
        this.rest<any[]>("posts?select=*"),
        this.rest<any[]>("board_stage?select=*&order=position.asc"),
        // Rules are small and bounded, so they travel with the first load. The
        // execution log does not: it only grows, and is fetched on demand.
        this.rest<any[]>("automation_rule?select=*&order=created_at.asc"),
        this.rest<any[]>("appointment?select=*&order=starts_at.asc"),
        this.rest<any[]>("booking?select=*&order=starts_at.asc"),
        this.rest<any[]>("marked_date?select=*&order=date.asc"),
        this.rest<any[]>("booking_config?select=*&limit=1"),
        this.rest<any[]>("service?select=*&order=position.asc"),
        this.rest<any[]>("proposal?select=*&order=created_at.desc"),
        this.rest<any[]>("contract?select=*&order=created_at.desc"),
        this.rest<any[]>("finance_account?select=*&order=name.asc"),
        this.rest<any[]>("finance_category?select=*&order=name.asc"),
        this.rest<any[]>("finance_entry?select=*&order=due_date.desc"),
        this.rest<any[]>("finance_series?select=*"),
        this.rest<any[]>("finance_transfer?select=*&order=date.desc"),
        this.rest<any[]>("crm_deal?select=*&order=updated_at.desc"),
        this.rest<any[]>("crm_interaction?select=*&order=at.desc"),
        this.rest<any[]>("crm_task?select=*&order=due_on.asc"),
        this.rest<any[]>("idea?select=*&order=created_at.desc"),
        this.rest<any[]>("monthly_plan?select=*&order=month.desc"),
        this.rest<any[]>("pauta_item?select=*&order=date.asc"),
        this.rest<any[]>("dossier_template?select=*&order=created_at.asc"),
        this.rest<any[]>("dossier?select=*"),
        this.rest<any[]>("project?select=*&order=created_at.desc"),
        this.rest<any[]>("squad?select=*&order=name.asc"),
        this.rest<any[]>("statement_line?select=*&order=date.desc"),
        this.rest<any[]>("script?select=*&order=created_at.desc"),
        this.rest<any[]>("assessment_template?select=*&order=created_at.asc"),
        this.rest<any[]>("assessment?select=*&order=created_at.desc"),
        this.rest<any[]>("webhook_subscription?select=*&order=created_at.asc"),
        // O histórico cresce sem parar: só as últimas entregas viajam.
        this.rest<any[]>("webhook_delivery?select=*&order=created_at.desc&limit=200"),
        this.rest<any[]>("briefing_form?select=*&order=created_at.desc"),
        this.rest<any[]>("form_response?select=*&order=at.desc"),
        this.rest<any[]>("agency_settings?select=*&limit=1"),
        this.rest<any[]>("ai_settings?select=*&limit=1"),
        this.rest<any[]>("crm_block?select=*"),
        this.rest<any[]>("contracting_process?select=*"),
      ]);
    return {
      clients: clients.map(toClient),
      calendars: calendars.map(toCalendar),
      posts: posts.map(toPost),
      boardStages: stages.map(toStage),
      automationRules: rules.map(toRule),
      appointments: appointments.map(toAppointment),
      bookings: bookings.map(toBooking),
      markedDates: marked.map(toMarkedDate),
      services: services.map(toService),
      proposals: proposals.map(toProposal),
      contracts: contracts.map(toContract),
      accounts: accounts.map(toAccount),
      categories: categories.map(toCategory),
      entries: entries.map(toEntry),
      series: finSeries.map(toSeries),
      transfers: transfers.map(toTransfer),
      deals: deals.map(toDeal),
      interactions: interactions.map(toInteraction),
      crmTasks: crmTasks.map(toCrmTask),
      ideas: ideas.map(toIdea),
      plans: plans.map(toPlan),
      pautaItems: pautaRows.map(toPautaItem),
      dossierTemplates: dossierTemplates.map(toDossierTemplate),
      dossiers: dossiers.map(toDossier),
      projects: projects.map(toProject),
      squads: squads.map(toSquad),
      statementLines: statementLines.map(toStatementLine),
      scripts: scripts.map(toScript),
      assessmentTemplates: assessmentTemplates.map(toAssessmentTemplate),
      assessments: assessments.map(toAssessment),
      webhooks: webhooks.map(toWebhook),
      webhookDeliveries: webhookDeliveries.map(toWebhookDelivery),
      forms: forms.map(toForm),
      formResponses: formResponses.map(toFormResponse),
      healthWeights: agencySettings[0]?.health_weights ?? undefined,
      aiSettings: aiSettings[0]
        ? {
            enabled: Boolean(aiSettings[0].enabled),
            model: aiSettings[0].model ?? "claude-opus-5-5",
            effort: aiSettings[0].effort ?? "medium",
            dailyLimit: aiSettings[0].daily_limit ?? 100,
            allowed: aiSettings[0].allowed ?? [],
          }
        : undefined,
      blocks: blocks.map(toBlock),
      processes: processes.map(toProcess),
      availability: cfg[0]
        ? {
            weekdays: cfg[0].weekdays ?? {},
            durationMinutes: cfg[0].duration_minutes,
            noticeHours: cfg[0].notice_hours,
            gapMinutes: cfg[0].gap_minutes,
          }
        : undefined,
      bookingPage: cfg[0]
        ? {
            linkId: cfg[0].link_id,
            active: cfg[0].active,
            title: cfg[0].title,
            intro: cfg[0].intro ?? undefined,
          }
        : undefined,
    };
  }

  // ── Clients ───────────────────────────────────────────────────
  async createClient(
    input: CreateClientInput,
  ): Promise<{ client: Client; calendar: Calendar }> {
    const name = input.name.trim();
    const [clientRow] = await this.rest<any[]>("clients", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name,
        color: input.color ?? "#8b5cf6",
        logo_url: input.logoUrl?.trim() || null,
        handle: input.handle?.trim() || null,
        email: input.email?.trim() || null,
        status: input.status ?? "active",
        active: (input.status ?? "active") === "active",
        segment: input.segment?.trim() || null,
      }),
    });
    const [calRow] = await this.rest<any[]>("calendars", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        client_id: clientRow.id,
        name: input.calendarName?.trim() || `Calendário ${name}`,
        share_token: shareToken(),
      }),
    });
    return { client: toClient(clientRow), calendar: toCalendar(calRow) };
  }

  async updateClient(id: string, patch: UpdateClientInput): Promise<Client> {
    const row: any = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.color !== undefined) row.color = patch.color;
    if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl.trim() || null;
    if (patch.handle !== undefined) row.handle = patch.handle.trim() || null;
    if (patch.email !== undefined) row.email = patch.email.trim() || null;
    if (patch.segment !== undefined) row.segment = patch.segment.trim() || null;
    if (patch.pinned !== undefined) row.pinned = patch.pinned;
    if (patch.servedSince !== undefined) row.served_since = patch.servedSince || null;
    if (patch.status !== undefined) {
      row.status = patch.status;
      row.active = patch.status === "active";
    }
    const [updated] = await this.rest<any[]>(`clients?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    return toClient(updated);
  }

  async regenerateShareToken(calendarId: string): Promise<Calendar> {
    const [updated] = await this.rest<any[]>(`calendars?id=eq.${calendarId}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ share_token: shareToken() }),
    });
    return toCalendar(updated);
  }

  // ── Posts ─────────────────────────────────────────────────────
  async createPost(input: CreatePostInput): Promise<Post> {
    const [row] = await this.rest<any[]>("posts", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        calendar_id: input.calendarId,
        title: input.title.trim(),
        date: input.date,
        status: input.status ?? "todo",
        description: input.description ?? "",
        content_type: input.contentType?.trim() || null,
        reference_link: input.referenceLink?.trim() || null,
        internal_notes: input.internalNotes?.trim() || null,
        idea_id: input.ideaId ?? null,
        project_id: input.projectId ?? null,
        reschedule_history: [],
      }),
    });
    return toPost(row);
  }

  private async fetchPost(id: string): Promise<Post> {
    const [row] = await this.rest<any[]>(`posts?id=eq.${id}&select=*`);
    if (!row) throw new Error("Post não encontrado.");
    return toPost(row);
  }

  async updatePost(id: string, patch: UpdatePostInput): Promise<Post> {
    const current = await this.fetchPost(id);
    const row: any = {};
    if (patch.title !== undefined) row.title = patch.title.trim();
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.contentType !== undefined) row.content_type = patch.contentType.trim() || null;
    if (patch.referenceLink !== undefined)
      row.reference_link = patch.referenceLink.trim() || null;
    if (patch.internalNotes !== undefined)
      row.internal_notes = patch.internalNotes.trim() || null;
    if (patch.checklist !== undefined) row.checklist = patch.checklist;
    if (patch.comments !== undefined) row.comments = patch.comments;
    if (patch.attachments !== undefined) row.attachments = patch.attachments;
    if (patch.timeEntries !== undefined) row.time_entries = patch.timeEntries;
    if (patch.stageId !== undefined) row.stage_id = patch.stageId || null;
    if (patch.projectId !== undefined) row.project_id = patch.projectId || null;
    if (patch.date !== undefined) {
      row.date = patch.date;
      if (patch.date !== current.date) {
        row.reschedule_history = [
          ...current.rescheduleHistory,
          { from: current.date, to: patch.date, at: new Date().toISOString() },
        ];
      }
    }
    const [updated] = await this.rest<any[]>(`posts?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    return toPost(updated);
  }

  async reschedulePost(id: string, newDate: string): Promise<Post> {
    const current = await this.fetchPost(id);
    const history =
      newDate !== current.date
        ? [
            ...current.rescheduleHistory,
            { from: current.date, to: newDate, at: new Date().toISOString() },
          ]
        : current.rescheduleHistory;
    const [updated] = await this.rest<any[]>(`posts?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        date: newDate,
        status: "rescheduled",
        reschedule_history: history,
      }),
    });
    return toPost(updated);
  }

  async deletePost(id: string): Promise<Post> {
    const [updated] = await this.rest<any[]>(`posts?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "deleted" }),
    });
    return toPost(updated);
  }

  async restorePost(id: string, status: PostStatus = "todo"): Promise<Post> {
    const [updated] = await this.rest<any[]>(`posts?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status }),
    });
    return toPost(updated);
  }

  // ── External review (Spec 03) ─────────────────────────────────
  async requestApproval(postId: string, teamMessage?: string): Promise<Post> {
    const [row] = await this.rest<any[]>(`rpc/request_approval`, {
      method: "POST",
      body: JSON.stringify({
        p_post_id: postId,
        p_team_message: teamMessage?.trim() || null,
      }),
    }).then((r) => (Array.isArray(r) ? r : [r]));
    if (!row) throw new Error("Não foi possível enviar para aprovação.");
    return toPost(row);
  }

  /**
   * Ask for a verification code and have it delivered.
   *
   * The Edge Function is the only path that can deliver: the database keeps
   * the plaintext code away from anything the browser can call (migration
   * 004). When the function is not deployed, or has no e-mail provider
   * configured, we fall back to the anonymous RPC so the code at least
   * exists — and report `delivered: false`, because a client staring at an
   * inbox that will never receive anything is worse than being told.
   */
  async issueApprovalCode(
    token: string,
    postId: string,
  ): Promise<{ maskedEmail?: string; devCode?: string; delivered?: boolean }> {
    const res = await this.http(`${this.base}/functions/v1/send-approval-code`, {
      method: "POST",
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, postId }),
    });

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        masked_email?: string;
      };
      return { maskedEmail: data.masked_email ?? undefined, delivered: true };
    }

    // 404: function not deployed. 501: deployed, but no provider configured.
    // Anything else is a real failure the client needs to hear about —
    // an invalid link, a post from another calendar, the 60s cooldown.
    if (res.status !== 404 && res.status !== 501) {
      const body = await res.text().catch(() => "");
      throw new Error(this.friendlyError(res.status, body));
    }

    const data = await this.rest<{ masked_email?: string } | null>(
      "rpc/issue_approval_code",
      {
        method: "POST",
        useUser: false, // the client is anonymous
        body: JSON.stringify({ p_token: token, p_post_id: postId }),
      },
    );
    return { maskedEmail: data?.masked_email ?? undefined, delivered: false };
  }

  async submitApprovalDecision(
    token: string,
    postId: string,
    input: {
      result: ApprovalResult;
      comment?: string;
      decidedByName: string;
      code?: string;
    },
  ): Promise<void> {
    const invalid = validateDecision(input);
    if (invalid) throw new Error(invalid); // fail fast before the round trip
    await this.rest<unknown>("rpc/submit_approval_decision", {
      method: "POST",
      useUser: false,
      body: JSON.stringify({
        p_token: token,
        p_post_id: postId,
        p_result: input.result,
        p_comment: input.comment?.trim() || null,
        p_decided_by: input.decidedByName.trim(),
        p_code: input.code?.trim() || null,
      }),
    });
  }

  // ── Public share view (anon RPC, isolated + sanitized) ────────
  // ── CRM e orquestrador ────────────────────────────────────────
  async saveDeal(deal: Deal): Promise<Deal> {
    const invalid = validateDeal(deal);
    if (invalid) throw new Error(invalid);
    const [row] = await this.rest<any[]>("crm_deal", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({ ...dealRow(deal), updated_at: new Date().toISOString() }),
    });
    return toDeal(row);
  }
  async deleteDeal(id: string): Promise<void> {
    await this.rest<void>(`crm_deal?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }
  async addInteraction(interaction: Interaction): Promise<Interaction> {
    const invalid = validateInteraction(interaction);
    if (invalid) throw new Error(invalid);
    const [row] = await this.rest<any[]>("crm_interaction", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: interaction.id,
        deal_id: interaction.dealId,
        kind: interaction.kind,
        at: interaction.at,
        author: interaction.author ?? null,
        content: interaction.content,
        answered: interaction.answered ?? null,
      }),
    });
    await this.rest<void>(`crm_deal?id=eq.${encodeURIComponent(interaction.dealId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_contact_on: interaction.at.slice(0, 10) }),
    });
    return toInteraction(row);
  }
  async saveAssessmentTemplate(template: AssessmentTemplate): Promise<AssessmentTemplate> {
    const [row] = await this.rest<any[]>("assessment_template", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: template.id,
        name: template.name.trim(),
        questions: template.questions,
        bands: template.bands,
        created_at: template.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toAssessmentTemplate(row);
  }

  async saveAssessment(assessment: Assessment): Promise<Assessment> {
    const [row] = await this.rest<any[]>("assessment", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: assessment.id,
        client_id: assessment.clientId,
        template_id: assessment.templateId,
        title: assessment.title.trim(),
        subjects: assessment.subjects,
        scores: assessment.scores,
        conclusions: assessment.conclusions ?? null,
        status: assessment.status,
        concluded_at: assessment.concludedAt ?? null,
        created_at: assessment.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toAssessment(row);
  }

  async deleteAssessment(id: string): Promise<void> {
    await this.rest<void>(`assessment?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async saveWebhook(subscription: WebhookSubscription): Promise<WebhookSubscription> {
    const [row] = await this.rest<any[]>("webhook_subscription", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: subscription.id,
        url: subscription.url.trim(),
        events: subscription.events,
        secret: subscription.secret,
        active: subscription.active,
        description: subscription.description ?? null,
        created_at: subscription.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toWebhook(row);
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.rest<void>(`webhook_subscription?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async enqueueWebhookTest(subscriptionId: string): Promise<WebhookDelivery> {
    const [sub] = await this.rest<any[]>(
      `webhook_subscription?id=eq.${encodeURIComponent(subscriptionId)}&select=*`,
    );
    if (!sub) throw new Error("Assinatura não encontrada.");
    const event = (sub.events ?? [])[0] ?? "post.aprovado";
    const [row] = await this.rest<any[]>("webhook_delivery", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        subscription_id: subscriptionId,
        event,
        payload: {
          id: crypto.randomUUID(),
          event,
          at: new Date().toISOString(),
          data: { teste: true },
        },
      }),
    });
    return toWebhookDelivery(row);
  }

  async saveScript(script: Script): Promise<Script> {
    // The version check lives in the database too (a trigger), so a race
    // between two tabs is refused there and not only here.
    const [row] = await this.rest<any[]>("script", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: script.id,
        post_id: script.postId,
        kind: script.kind,
        title: script.title.trim(),
        goal: script.goal ?? null,
        audience: script.audience ?? null,
        tone: script.tone ?? null,
        cta: script.cta ?? null,
        hashtags: script.hashtags ?? null,
        caption: script.caption ?? null,
        scenes: script.scenes,
        fields: script.fields,
        status: script.status,
        version: script.version + 1,
        created_at: script.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toScript(row);
  }

  async deleteScript(id: string): Promise<void> {
    await this.rest<void>(`script?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async saveForm(form: BriefingForm): Promise<BriefingForm> {
    const [row] = await this.rest<any[]>("briefing_form", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: form.id,
        title: form.title.trim(),
        description: form.description ?? null,
        client_id: form.clientId ?? null,
        questions: form.questions,
        status: form.status,
        share_token: form.shareToken,
        created_at: form.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toForm(row);
  }

  async deleteForm(id: string): Promise<void> {
    // form_response.form_id is ON DELETE CASCADE: the answers go with it,
    // which is the ficha's rule and what the screen warns about.
    await this.rest<void>(`briefing_form?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async getPublicForm(token: string): Promise<PublicForm | null> {
    const data = await this.rest<PublicForm | null>("rpc/public_form", {
      method: "POST",
      useUser: false,
      body: JSON.stringify({ p_token: token }),
    });
    return data ?? null;
  }

  async submitForm(
    token: string,
    answers: Record<string, string | string[] | number>,
    respondent?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    try {
      await this.rest<void>("rpc/public_submit_form", {
        method: "POST",
        useUser: false,
        body: JSON.stringify({ p_token: token, p_answers: answers, p_respondent: respondent ?? null }),
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "Não deu para enviar." };
    }
  }

  async saveStatementLines(lines: StatementLine[]): Promise<StatementLine[]> {
    if (lines.length === 0) return [];
    const rows = await this.rest<any[]>("statement_line", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(
        lines.map((l) => ({
          id: l.id,
          account_id: l.accountId,
          key: l.key,
          date: l.date,
          description: l.description,
          amount_cents: l.amount,
          status: l.status,
          entry_id: l.entryId ?? null,
          settled_entry: l.settledEntry ?? null,
          reconciled_at: l.reconciledAt ?? null,
          created_at: l.createdAt,
        })),
      ),
    });
    return rows.map(toStatementLine);
  }

  async deleteStatementLine(id: string): Promise<void> {
    await this.rest<void>(`statement_line?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async saveProject(project: Project): Promise<Project> {
    const [row] = await this.rest<any[]>("project", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: project.id,
        name: project.name.trim(),
        client_id: project.clientId,
        squad_id: project.squadId ?? null,
        service_id: project.serviceId ?? null,
        due_date: project.dueDate ?? null,
        value_cents: project.value,
        status: project.status,
        color: project.color ?? null,
        contract_id: project.contractId ?? null,
        notes: project.notes ?? null,
        created_at: project.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toProject(row);
  }

  async deleteProject(id: string): Promise<void> {
    // posts.project_id and finance_entry.project_id are ON DELETE SET NULL:
    // removing a cost centre must not remove the work or the costs.
    await this.rest<void>(`project?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async saveSquad(squad: Squad): Promise<Squad> {
    const [row] = await this.rest<any[]>("squad", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: squad.id,
        name: squad.name.trim(),
        description: squad.description ?? null,
        color: squad.color ?? null,
        icon: squad.icon ?? null,
        lead: squad.lead ?? null,
        members: squad.members,
        created_at: squad.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toSquad(row);
  }

  async deleteSquad(id: string): Promise<void> {
    await this.rest<void>(`squad?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async saveAiSettings(settings: AiSettings): Promise<void> {
    await this.rest<void>("ai_settings", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: 1,
        enabled: settings.enabled,
        model: settings.model.trim() || "claude-opus-5-5",
        effort: settings.effort,
        daily_limit: Math.min(10_000, Math.max(1, Math.round(settings.dailyLimit))),
        allowed: settings.allowed,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  async saveHealthWeights(weights: HealthWeights): Promise<void> {
    await this.rest<void>("agency_settings", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify({ id: 1, health_weights: weights }),
    });
  }

  async saveDossierTemplate(template: DossierTemplate): Promise<DossierTemplate> {
    const [row] = await this.rest<any[]>("dossier_template", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: template.id,
        name: template.name.trim(),
        sections: template.sections,
        created_at: template.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toDossierTemplate(row);
  }

  async saveDossier(dossier: Dossier): Promise<Dossier> {
    const [row] = await this.rest<any[]>("dossier", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: dossier.id,
        client_id: dossier.clientId,
        template_id: dossier.templateId,
        sections: dossier.sections,
        share_token: dossier.shareToken ?? null,
        share_enabled: dossier.shareEnabled,
        created_at: dossier.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toDossier(row);
  }

  async getPublicDossier(token: string): Promise<PublicDossier | null> {
    // A SECURITY DEFINER function, called anonymously: the anon role has no
    // grant on `dossier`, so the internal sections are not merely filtered
    // in the client — they never leave the database.
    const data = await this.rest<PublicDossier | null>("rpc/public_dossier", {
      method: "POST",
      useUser: false,
      body: JSON.stringify({ p_token: token }),
    });
    return data ?? null;
  }

  async savePlan(plan: MonthlyPlan): Promise<MonthlyPlan> {
    const [row] = await this.rest<any[]>("monthly_plan", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: plan.id,
        client_id: plan.clientId,
        month: plan.month,
        goals: plan.goals,
        objectives: plan.objectives,
        improvements: plan.improvements,
        pillars: plan.pillars,
        funnel: plan.funnel,
        actions: plan.actions,
        closing: plan.closing ?? null,
        status: plan.status,
        validated_at: plan.validatedAt ?? null,
        created_at: plan.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toPlan(row);
  }

  async deletePlan(id: string): Promise<void> {
    await this.rest<void>(`monthly_plan?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async savePautaItems(items: PautaItem[]): Promise<PautaItem[]> {
    if (items.length === 0) return [];
    // One request for a whole weekly series: twelve round trips to write one
    // repetition is how a plan ends up half saved.
    const rows = await this.rest<any[]>("pauta_item", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(
        items.map((item) => ({
          id: item.id,
          client_id: item.clientId,
          date: item.date,
          kind: item.kind,
          title: item.title.trim(),
          channels: item.channels,
          format: item.format ?? null,
          briefing: item.briefing ?? null,
          caption: item.caption ?? null,
          pillar_id: item.pillarId ?? null,
          funnel: item.funnel ?? null,
          owner: item.owner ?? null,
          status: item.status,
          post_id: item.postId ?? null,
          calendar_id: item.calendarId ?? null,
          series_id: item.seriesId ?? null,
          created_at: item.createdAt,
          updated_at: new Date().toISOString(),
        })),
      ),
    });
    return rows.map(toPautaItem);
  }

  async deletePautaItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const list = ids.map((id) => `"${encodeURIComponent(id)}"`).join(",");
    await this.rest<void>(`pauta_item?id=in.(${list})`, { method: "DELETE" });
  }

  async saveIdea(idea: Idea): Promise<Idea> {
    const [row] = await this.rest<any[]>("idea", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: idea.id,
        text: idea.text.trim(),
        client_id: idea.scope.kind === "cliente" ? idea.scope.clientId : null,
        tags: idea.tags,
        mentions: idea.mentions,
        format: idea.format ?? null,
        status: idea.status,
        votes: idea.votes,
        used_by: idea.usedBy,
        created_by: idea.createdBy,
        created_at: idea.createdAt,
        updated_at: new Date().toISOString(),
      }),
    });
    return toIdea(row);
  }

  async deleteIdea(id: string): Promise<void> {
    await this.rest<void>(`idea?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async saveCrmTask(task: CrmTask): Promise<CrmTask> {
    const [row] = await this.rest<any[]>("crm_task", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: task.id,
        deal_id: task.dealId,
        title: task.title.trim(),
        due_on: task.dueOn,
        note: task.note ?? null,
        done_at: task.doneAt ?? null,
        result: task.result ?? null,
      }),
    });
    return toCrmTask(row);
  }
  async deleteCrmTask(id: string): Promise<void> {
    await this.rest<void>(`crm_task?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }
  async saveBlock(block: ContactBlock): Promise<ContactBlock> {
    const [row] = await this.rest<any[]>("crm_block", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: block.id,
        kind: block.kind,
        value: block.value.trim().toLowerCase(),
        reason: block.reason ?? null,
        at: block.at,
      }),
    });
    return toBlock(row);
  }
  async deleteBlock(id: string): Promise<void> {
    await this.rest<void>(`crm_block?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }
  async saveProcess(process: ContractingProcess): Promise<ContractingProcess> {
    const [row] = await this.rest<any[]>("contracting_process", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: process.id,
        proposal_id: process.proposalId,
        deal_id: process.dealId ?? null,
        client_id: process.clientId ?? null,
        status: process.status,
        steps: process.steps,
        started_at: process.startedAt,
        finished_at: process.finishedAt ?? null,
      }),
    });
    return toProcess(row);
  }

  // ── Financeiro ────────────────────────────────────────────────
  // Upserts throughout. The rules that must not be negotiable — a settled
  // amount never changing, a settled entry never being deleted — are database
  // triggers (migration 009), not checks up here.
  async saveAccount(account: FinanceAccount): Promise<FinanceAccount> {
    const [row] = await this.rest<any[]>("finance_account", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(accountRow(account)),
    });
    return toAccount(row);
  }
  async deleteAccount(id: string): Promise<void> {
    await this.rest<void>(`finance_account?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
  async saveCategory(category: FinanceCategory): Promise<FinanceCategory> {
    const [row] = await this.rest<any[]>("finance_category", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(categoryRow(category)),
    });
    return toCategory(row);
  }
  async deleteCategory(id: string): Promise<void> {
    await this.rest<void>(`finance_category?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async saveEntry(entry: FinanceEntry): Promise<FinanceEntry> {
    const invalid = validateEntry(entry);
    if (invalid) throw new Error(invalid);
    const [row] = await this.rest<any[]>("finance_entry", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(entryRow(entry)),
    });
    return toEntry(row);
  }
  async deleteEntry(id: string): Promise<void> {
    await this.rest<void>(`finance_entry?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
  async settleEntry(id: string, accountId: string, date: string): Promise<FinanceEntry> {
    const [row] = await this.rest<any[]>(`finance_entry?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "liquidado", settled_at: date, account_id: accountId }),
    });
    if (!row) throw new Error("Lançamento não encontrado.");
    return toEntry(row);
  }
  async unsettleEntry(id: string): Promise<FinanceEntry> {
    const [row] = await this.rest<any[]>(`finance_entry?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "pendente", settled_at: null }),
    });
    if (!row) throw new Error("Lançamento não encontrado.");
    return toEntry(row);
  }
  async reverseEntry(id: string): Promise<FinanceEntry> {
    const [current] = await this.rest<any[]>(
      `finance_entry?id=eq.${encodeURIComponent(id)}&select=*`,
    );
    if (!current) throw new Error("Lançamento não encontrado.");
    const entry = toEntry(current);
    if (entry.status !== "liquidado")
      throw new Error("Só um lançamento liquidado é estornado.");
    const reversal = buildReversal(entry, crypto.randomUUID());
    const [row] = await this.rest<any[]>("finance_entry", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(entryRow(reversal)),
    });
    return toEntry(row);
  }

  async saveSeries(series: FinanceSeries): Promise<FinanceSeries> {
    const invalid = validateSeries(series);
    if (invalid) throw new Error(invalid);
    const [row] = await this.rest<any[]>("finance_series", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(seriesRow(series)),
    });
    return toSeries(row);
  }
  async deleteSeries(id: string): Promise<void> {
    // Open rows go with the series; settled ones stay, because they happened.
    await this.rest<void>(
      `finance_entry?series_id=eq.${encodeURIComponent(id)}&status=neq.liquidado`,
      { method: "DELETE" },
    );
    await this.rest<void>(`finance_series?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
  async materialiseSeries(): Promise<number> {
    const [series, entries] = await Promise.all([
      this.rest<any[]>("finance_series?select=*"),
      this.rest<any[]>("finance_entry?select=*&series_id=not.is.null"),
    ]);
    const due = dueForMaterialisation(series.map(toSeries), entries.map(toEntry));
    if (due.length === 0) return 0;
    await this.rest<void>("finance_entry", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(
        due.map((e) => entryRow({ ...e, id: crypto.randomUUID() })),
      ),
    });
    return due.length;
  }

  async saveTransfer(transfer: Transfer): Promise<Transfer> {
    const invalid = validateTransfer(transfer);
    if (invalid) throw new Error(invalid);
    const [row] = await this.rest<any[]>("finance_transfer", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: transfer.id,
        from_account_id: transfer.fromAccountId,
        to_account_id: transfer.toAccountId,
        amount_cents: transfer.amount,
        date: transfer.date,
        note: transfer.note ?? null,
      }),
    });
    return toTransfer(row);
  }
  async deleteTransfer(id: string): Promise<void> {
    await this.rest<void>(`finance_transfer?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  // ── Catálogo, propostas e contratos ───────────────────────────
  async createService(input: Omit<Service, "id" | "createdAt">): Promise<Service> {
    const invalid = validateService(input);
    if (invalid) throw new Error(invalid);
    const [row] = await this.rest<any[]>("service", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(serviceRow(input)),
    });
    return toService(row);
  }

  async updateService(id: string, patch: Partial<Service>): Promise<Service> {
    const [row] = await this.rest<any[]>(`service?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(serviceRow(patch)),
    });
    if (!row) throw new Error("Serviço não encontrado.");
    return toService(row);
  }

  async deleteService(id: string): Promise<void> {
    await this.rest<void>(`service?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async saveProposal(proposal: Proposal): Promise<Proposal> {
    const invalid = validateProposal(proposal);
    if (invalid) throw new Error(invalid);
    // The database refuses a write to an accepted proposal (migration 008),
    // so this cannot be talked around from the client.
    const [row] = await this.rest<any[]>("proposal", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(proposalRow(proposal)),
    });
    return toProposal(row);
  }

  async sendProposal(id: string): Promise<Proposal> {
    const data = await this.rest<any>("rpc/send_proposal", {
      method: "POST",
      body: JSON.stringify({ p_id: id }),
    });
    return toProposal(data);
  }

  async deleteProposal(id: string): Promise<void> {
    await this.rest<void>(
      `proposal?id=eq.${encodeURIComponent(id)}&status=in.(rascunho,arquivada)`,
      { method: "DELETE" },
    );
  }

  async saveContract(contract: Contract): Promise<Contract> {
    const [row] = await this.rest<any[]>("contract", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(contractRow(contract)),
    });
    return toContract(row);
  }

  async deleteContract(id: string): Promise<void> {
    await this.rest<void>(`contract?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  // ── Public proposal and contract (no session) ─────────────────
  async getPublicProposal(linkId: string): Promise<Proposal | null> {
    const data = await this.rest<any>("rpc/public_proposal", {
      method: "POST",
      useUser: false,
      body: JSON.stringify({ p_link: linkId, p_agent: navigator.userAgent }),
    });
    return data ? toProposal(data) : null;
  }

  async decideProposal(
    linkId: string,
    input: {
      result: Extract<ProposalStatus, "aceita" | "recusada" | "ajuste_pedido">;
      deciderName: string;
      deciderDocument?: string;
      reason?: string;
    },
  ): Promise<void> {
    await this.rest<void>("rpc/public_decide_proposal", {
      method: "POST",
      useUser: false,
      body: JSON.stringify({
        p_link: linkId,
        p_result: input.result,
        p_name: input.deciderName,
        p_document: input.deciderDocument ?? null,
        p_reason: input.reason ?? null,
      }),
    });
  }

  async getPublicContract(partyToken: string) {
    const data = await this.rest<any>("rpc/public_contract", {
      method: "POST",
      useUser: false,
      body: JSON.stringify({ p_token: partyToken }),
    });
    if (!data) return null;
    return { contract: toContract(data.contract), partyId: data.partyId };
  }

  async signContract(
    partyToken: string,
    input: { typedName: string; typedDocument: string },
  ): Promise<void> {
    const invalid = validateSignature(input);
    if (invalid) throw new Error(invalid);
    await this.rest<void>("rpc/public_sign_contract", {
      method: "POST",
      useUser: false,
      body: JSON.stringify({
        p_token: partyToken,
        p_name: input.typedName.trim(),
        p_document: input.typedDocument.replace(/\D/g, ""),
        p_agent: navigator.userAgent,
      }),
    });
  }

  // ── Agenda ────────────────────────────────────────────────────
  async createAppointment(
    input: Omit<Appointment, "id" | "createdAt">,
  ): Promise<Appointment> {
    const invalid = validateAppointment(input);
    if (invalid) throw new Error(invalid);
    const [row] = await this.rest<any[]>("appointment", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        client_id: input.clientId ?? null,
        title: input.title.trim(),
        description: input.description ?? null,
        starts_at: input.start,
        ends_at: input.end,
        location: input.location ?? null,
        status: input.status,
        source: input.source,
        done: input.done ?? false,
      }),
    });
    return toAppointment(row);
  }

  async updateAppointment(id: string, patch: Partial<Appointment>): Promise<Appointment> {
    const row: any = {};
    if (patch.title !== undefined) row.title = patch.title.trim();
    if (patch.description !== undefined) row.description = patch.description || null;
    if (patch.clientId !== undefined) row.client_id = patch.clientId || null;
    if (patch.start !== undefined) row.starts_at = patch.start;
    if (patch.end !== undefined) row.ends_at = patch.end;
    if (patch.location !== undefined) row.location = patch.location || null;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.done !== undefined) row.done = patch.done;
    const [updated] = await this.rest<any[]>(`appointment?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!updated) throw new Error("Compromisso não encontrado.");
    return toAppointment(updated);
  }

  async addMarkedDate(date: MarkedDate): Promise<void> {
    await this.rest<void>("marked_date", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({
        id: date.id,
        date: date.date,
        name: date.name,
        category: date.category,
        color: date.color ?? null,
        sensitive: date.sensitive ?? false,
        custom: date.custom ?? false,
      }),
    });
  }

  async removeMarkedDate(id: string): Promise<void> {
    await this.rest<void>(`marked_date?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async saveBookingConfig(input: {
    availability: Availability;
    page: Pick<BookingPage, "active" | "title" | "intro">;
  }): Promise<void> {
    await this.rest<void>("booking_config", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify({
        id: 1,
        weekdays: input.availability.weekdays,
        duration_minutes: input.availability.durationMinutes,
        notice_hours: input.availability.noticeHours,
        gap_minutes: input.availability.gapMinutes,
        active: input.page.active,
        title: input.page.title,
        intro: input.page.intro ?? null,
        // link_id is NOT NULL: on a first save there is nothing to merge into,
        // so seed one here and let regenerateBookingLink replace it later.
        link_id: await this.currentLinkId(),
      }),
    });
  }

  private async currentLinkId(): Promise<string> {
    const [row] = await this.rest<any[]>("booking_config?select=link_id&limit=1");
    return row?.link_id ?? shareToken();
  }

  async regenerateBookingLink(): Promise<BookingPage> {
    const linkId = shareToken();
    const [row] = await this.rest<any[]>("booking_config?id=eq.1", {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ link_id: linkId }),
    });
    if (!row) throw new Error("Configuração de agendamento não encontrada.");
    return {
      linkId: row.link_id,
      active: row.active,
      title: row.title,
      intro: row.intro ?? undefined,
    };
  }

  // ── Public booking ────────────────────────────────────────────
  // Four SECURITY DEFINER functions (migration 007). The visitor never
  // touches a table: a paused page answers exactly like a missing one, and
  // busy blocks carry no name, no e-mail, nothing.
  async getPublicBookingPage(linkId: string) {
    const data = await this.rest<any>("rpc/public_booking_page", {
      method: "POST",
      useUser: false,
      body: JSON.stringify({ p_link: linkId }),
    });
    if (!data) return null;
    return {
      page: { linkId, active: true, title: data.title, intro: data.intro ?? undefined },
      availability: {
        weekdays: data.weekdays ?? {},
        durationMinutes: data.durationMinutes,
        noticeHours: data.noticeHours,
        gapMinutes: data.gapMinutes,
      },
    };
  }

  async getPublicBusy(linkId: string, from: string, to: string) {
    const data = await this.rest<{ start: string; end: string }[] | null>(
      "rpc/public_booking_busy",
      {
        method: "POST",
        useUser: false,
        body: JSON.stringify({ p_link: linkId, p_from: from, p_to: to }),
      },
    );
    return data ?? null;
  }

  async createPublicBooking(
    linkId: string,
    input: { name: string; email: string; start: string; note?: string },
  ) {
    const invalid = validateBooking(input);
    if (invalid) throw new Error(invalid);
    const data = await this.rest<any>("rpc/public_create_booking", {
      method: "POST",
      useUser: false,
      body: JSON.stringify({
        p_link: linkId,
        p_name: input.name,
        p_email: input.email,
        p_start: input.start,
        p_note: input.note ?? null,
      }),
    });
    return { manageToken: data.manageToken, start: data.start, end: data.end };
  }

  async cancelPublicBooking(manageToken: string): Promise<void> {
    await this.rest<void>("rpc/public_cancel_booking", {
      method: "POST",
      useUser: false,
      body: JSON.stringify({ p_token: manageToken }),
    });
  }

  // ── Board columns ─────────────────────────────────────────────
  // Table `board_stage`, admin-only (RLS in 006_colunas_do_quadro.sql).
  // `order` is a reserved word in SQL, so the column is called `position`.
  async createBoardStage(input: Omit<BoardStage, "id">): Promise<BoardStage> {
    const [row] = await this.rest<any[]>("board_stage", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        calendar_id: input.calendarId,
        name: input.name.trim(),
        color: input.color,
        category: input.category,
        position: input.order,
      }),
    });
    return toStage(row);
  }

  async updateBoardStage(
    id: string,
    patch: Partial<Pick<BoardStage, "name" | "color" | "category" | "order">>,
  ): Promise<BoardStage> {
    const row: any = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.color !== undefined) row.color = patch.color;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.order !== undefined) row.position = patch.order;

    const [updated] = await this.rest<any[]>(
      `board_stage?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      },
    );
    if (!updated) throw new Error("Coluna não encontrada.");
    return toStage(updated);
  }

  async deleteBoardStage(id: string): Promise<void> {
    // posts.stage_id is ON DELETE SET NULL, so the cards fall back to another
    // column of the same category on their own.
    await this.rest<void>(`board_stage?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async reorderBoardStages(order: { id: string; order: number }[]): Promise<void> {
    // No bulk update in PostgREST without an RPC; the list is at most a dozen
    // rows, and sending them together keeps the board from rendering
    // half-sorted.
    await Promise.all(
      order.map((o) =>
        this.rest<void>(`board_stage?id=eq.${encodeURIComponent(o.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ position: o.order }),
        }),
      ),
    );
  }

  // ── Stage automations ─────────────────────────────────────────
  // Tables `automation_rule` / `automation_run`, readable and writable only by
  // an authenticated admin (RLS in supabase/migrations/003_automacoes.sql).
  // Anonymous share-link holders have no grant on either table.
  async createAutomationRule(
    input: Omit<AutomationRule, "id" | "createdAt">,
  ): Promise<AutomationRule> {
    const invalid = validateRule(input);
    if (invalid) throw new Error(invalid);
    const [row] = await this.rest<any[]>("automation_rule", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        calendar_id: input.calendarId,
        trigger: input.trigger,
        action: input.action,
        active: input.active,
      }),
    });
    return toRule(row);
  }

  async updateAutomationRule(
    id: string,
    patch: Partial<Pick<AutomationRule, "active" | "trigger" | "action">>,
  ): Promise<AutomationRule> {
    const body: Record<string, unknown> = {};
    if (patch.active !== undefined) body.active = patch.active;
    if (patch.trigger !== undefined) body.trigger = patch.trigger;
    if (patch.action !== undefined) body.action = patch.action;

    const [row] = await this.rest<any[]>(
      `automation_rule?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(body),
      },
    );
    if (!row) throw new Error("Regra não encontrada.");
    const next = toRule(row);
    const invalid = validateRule(next);
    if (invalid) throw new Error(invalid);
    return next;
  }

  async deleteAutomationRule(id: string): Promise<void> {
    await this.rest<void>(`automation_rule?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async logAutomationRun(run: AutomationRun): Promise<void> {
    // The log is an audit trail, not a precondition: if the insert is refused
    // the automation itself still happened, so this must not throw upwards.
    try {
      await this.rest<void>("automation_run", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          rule_id: run.ruleId,
          post_id: run.postId,
          at: run.at,
          result: run.result,
          detail: run.detail ?? null,
          event_key: run.eventKey ?? null,
        }),
      });
    } catch (err) {
      console.error("Falha ao registrar execução de automação", err);
    }
  }

  async findAutomationRuns(eventKeys: string[]): Promise<AutomationRun[]> {
    if (!this.session || eventKeys.length === 0) return [];
    // PostgREST `in.(…)` wants the values quoted and comma-separated.
    const list = eventKeys
      .map((k) => `"${k.replace(/"/g, '\\"')}"`)
      .join(",");
    const rows = await this.rest<any[]>(
      `automation_run?event_key=in.(${encodeURIComponent(list)})&select=*`,
    );
    return rows.map(toRun);
  }

  async listAutomationRuns(calendarId: string, limit = 50): Promise<AutomationRun[]> {
    if (!this.session) return [];
    // `post!inner` filters runs down to this calendar's posts server-side.
    const rows = await this.rest<any[]>(
      `automation_run?select=*,posts!inner(calendar_id)&posts.calendar_id=eq.${encodeURIComponent(
        calendarId,
      )}&order=at.desc&limit=${limit}`,
    );
    return rows.map(toRun);
  }

  async getPublicView(token: string): Promise<PublicCalendarView | null> {
    const data = await this.rest<PublicCalendarView | null>("rpc/get_public_calendar", {
      method: "POST",
      useUser: false, // anonymous client
      body: JSON.stringify({ p_token: token }),
    });
    return data ?? null;
  }
}
