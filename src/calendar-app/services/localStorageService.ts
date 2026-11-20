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
  ClientStatus,
  Client,
  CreateClientInput,
  CreatePostInput,
  Database,
  Booking,
  Post,
  PostStatus,
  PublicCalendarView,
  Session,
  UpdateClientInput,
  UpdatePostInput,
} from "../types";
import { randomClientColor, shareToken, uid } from "../utils";
import { normalizeStatus } from "../health";
import { validatePlan, validatePlanItem as validatePautaItem } from "../pauta";
import { publicSections, validateTemplate } from "../dossier";
import { validateProject, validateSquad, validateWeights } from "../projects";
import { isOpen as isFormOpen, validateAnswers, validateForm } from "../forms";
import { validateScript } from "../scripts";
import {
  validateAssessment,
  validateTemplate as validateAssessmentTemplate,
} from "../assessment";
import {
  buildPayload as buildWebhookPayload,
  newDelivery as newWebhookDelivery,
  validateSubscription,
} from "../webhooks";
import {
  APPROVAL_CODE_TTL_MS,
  codesMatch,
  generateApprovalCode,
  maskEmail,
  validateDecision,
} from "../approval";
import {
  validateRule,
  type AutomationRule,
  type AutomationRun,
} from "../automation";
import {
  DEFAULT_AVAILABILITY,
  hasConflict,
  validateAppointment,
  validateBooking,
} from "../agenda";
import {
  canTransition,
  isEditable,
  validateService,
  isExpired,
  nextProposalNumber,
  validateProposal,
} from "../proposals";
import {
  canEditText,
  deriveStatus,
  hasSigned,
  validateSignature,
} from "../contracts";
import {
  accountHasMovement,
  buildReversal,
  canEditAmount,
  canTransition as canTransitionEntry,
  dueForMaterialisation,
  validateEntry,
  validateSeries,
  validateTransfer,
} from "../finance";
import { validateDeal, validateInteraction } from "../crm";
import { buildSeed } from "./seed";
import type { DataService } from "./DataService";

const DB_KEY = "editorial-calendar:db:v1";
const SESSION_KEY = "editorial-calendar:session:v1";

/** Keep the demo blob from growing without bound. */
const AUTOMATION_LOG_MAX = 500;


/**
 * Demo admin credentials. These are for the offline/localStorage demo only and
 * are NOT a real authentication mechanism — production uses Supabase Auth.
 * Override via VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD.
 */
const ADMIN_EMAIL =
  (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim() ||
  "admin@digitalclick.com";
const ADMIN_PASSWORD =
  (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || "nexa2026";
const ADMIN_NAME =
  (import.meta.env.VITE_ADMIN_NAME as string | undefined)?.trim() ||
  "Administrador";

function nowISO() {
  return new Date().toISOString();
}

/**
 * localStorage-backed implementation of {@link DataService}.
 *
 * All data lives in one JSON blob. Reads/writes are synchronous under the hood
 * but the methods are async to match the interface (and the Supabase adapter).
 */
export class LocalStorageService implements DataService {
  readonly name = "localStorage";

  private read(): Database {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Database;
        // Defensive defaults in case of an older/partial blob.
        parsed.clients ??= [];
        parsed.calendars ??= [];
        parsed.posts ??= [];
        parsed.boardStages ??= [];
        parsed.deals ??= [];
        parsed.interactions ??= [];
        parsed.crmTasks ??= [];
        parsed.ideas ??= [];
        parsed.plans ??= [];
        parsed.dossierTemplates ??= [];
        parsed.dossiers ??= [];
        parsed.statementLines ??= [];
        parsed.scripts ??= [];
        parsed.assessmentTemplates ??= [];
        parsed.assessments ??= [];
        parsed.webhooks ??= [];
        parsed.webhookDeliveries ??= [];
        parsed.forms ??= [];
        parsed.formResponses ??= [];
        parsed.projects ??= [];
        parsed.squads ??= [];
        parsed.pautaItems ??= [];
        parsed.blocks ??= [];
        parsed.processes ??= [];
        parsed.accounts ??= [];
        parsed.categories ??= [];
        parsed.entries ??= [];
        parsed.series ??= [];
        parsed.transfers ??= [];
        parsed.services ??= [];
        parsed.proposals ??= [];
        parsed.contracts ??= [];
        parsed.appointments ??= [];
        parsed.bookings ??= [];
        parsed.markedDates ??= [];
        parsed.automationRules ??= [];
        parsed.automationRuns ??= [];
        // Legacy records only had the boolean; derive the lifecycle from it.
        parsed.clients = parsed.clients.map((c) => {
          const status = normalizeStatus(c);
          return { ...c, status, active: status === "active" };
        });
        return parsed;
      }
    } catch {
      // fall through to seed
    }
    const seeded = buildSeed();
    this.write(seeded);
    return seeded;
  }

  private write(db: Database): void {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (err) {
      // Storage full / unavailable — surface so callers can toast.
      console.error("Falha ao salvar dados localmente", err);
      throw new Error("Não foi possível salvar os dados neste navegador.");
    }
  }

  // ── Auth ──────────────────────────────────────────────────────
  getSession(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }

  async login(email: string, password: string): Promise<Session> {
    const normalized = email.trim().toLowerCase();
    if (normalized !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
      throw new Error("E-mail ou senha inválidos.");
    }
    const session: Session = { role: "admin", email: ADMIN_EMAIL, name: ADMIN_NAME };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async initSession(): Promise<Session | null> {
    return this.getSession();
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  // ── Reads ─────────────────────────────────────────────────────
  async getDatabase(): Promise<Database> {
    return this.read();
  }

  // ── Clients ───────────────────────────────────────────────────
  async createClient(
    input: CreateClientInput,
  ): Promise<{ client: Client; calendar: Calendar }> {
    const db = this.read();
    const name = input.name.trim();
    if (!name) throw new Error("O nome do cliente é obrigatório.");

    const client: Client = {
      id: uid("cli"),
      name,
      color: input.color || randomClientColor(),
      logoUrl: input.logoUrl?.trim() || undefined,
      handle: input.handle?.trim() || undefined,
      email: input.email?.trim() || undefined,
      status: input.status ?? "active",
      active: (input.status ?? "active") === "active",
      segment: input.segment?.trim() || undefined,
      createdAt: nowISO(),
    };
    const calendar: Calendar = {
      id: uid("cal"),
      clientId: client.id,
      name: input.calendarName?.trim() || `Calendário ${name}`,
      shareToken: shareToken(),
      createdAt: nowISO(),
    };
    db.clients.push(client);
    db.calendars.push(calendar);
    this.write(db);
    return { client, calendar };
  }

  async updateClient(id: string, patch: UpdateClientInput): Promise<Client> {
    const db = this.read();
    const client = db.clients.find((c) => c.id === id);
    if (!client) throw new Error("Cliente não encontrado.");
    if (patch.name !== undefined) client.name = patch.name.trim();
    if (patch.color !== undefined) client.color = patch.color;
    if (patch.logoUrl !== undefined) client.logoUrl = patch.logoUrl.trim() || undefined;
    if (patch.handle !== undefined) client.handle = patch.handle.trim() || undefined;
    if (patch.email !== undefined) client.email = patch.email.trim() || undefined;
    if (patch.segment !== undefined) client.segment = patch.segment.trim() || undefined;
    if (patch.pinned !== undefined) client.pinned = patch.pinned;
    if (patch.servedSince !== undefined)
      client.servedSince = patch.servedSince || undefined;
    if (patch.status !== undefined) {
      client.status = patch.status as ClientStatus;
      client.active = patch.status === "active"; // keep the mirror honest
    }
    this.write(db);
    return client;
  }

  // ── Calendars ─────────────────────────────────────────────────
  async regenerateShareToken(calendarId: string): Promise<Calendar> {
    const db = this.read();
    const calendar = db.calendars.find((c) => c.id === calendarId);
    if (!calendar) throw new Error("Calendário não encontrado.");
    calendar.shareToken = shareToken();
    this.write(db);
    return calendar;
  }

  // ── Posts ─────────────────────────────────────────────────────
  async createPost(input: CreatePostInput): Promise<Post> {
    const db = this.read();
    const calendar = db.calendars.find((c) => c.id === input.calendarId);
    if (!calendar) throw new Error("Calendário não encontrado.");
    const title = input.title.trim();
    if (!title) throw new Error("O título do post é obrigatório.");

    const post: Post = {
      id: uid("post"),
      calendarId: input.calendarId,
      title,
      date: input.date,
      status: input.status ?? "todo",
      description: input.description ?? "",
      contentType: input.contentType?.trim() || undefined,
      referenceLink: input.referenceLink?.trim() || undefined,
      internalNotes: input.internalNotes?.trim() || undefined,
      ideaId: input.ideaId || undefined,
      rescheduleHistory: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    db.posts.push(post);
    this.write(db);
    return post;
  }

  async updatePost(id: string, patch: UpdatePostInput): Promise<Post> {
    const db = this.read();
    const post = db.posts.find((p) => p.id === id);
    if (!post) throw new Error("Post não encontrado.");

    // If the date changes via a normal edit, still record the reschedule
    // history so nothing is silently lost.
    if (patch.date !== undefined && patch.date !== post.date) {
      post.rescheduleHistory = [
        ...post.rescheduleHistory,
        { from: post.date, to: patch.date, at: nowISO() },
      ];
    }

    if (patch.title !== undefined) post.title = patch.title.trim();
    if (patch.date !== undefined) post.date = patch.date;
    if (patch.status !== undefined) post.status = patch.status;
    if (patch.description !== undefined) post.description = patch.description;
    if (patch.contentType !== undefined)
      post.contentType = patch.contentType.trim() || undefined;
    if (patch.referenceLink !== undefined)
      post.referenceLink = patch.referenceLink.trim() || undefined;
    if (patch.internalNotes !== undefined)
      post.internalNotes = patch.internalNotes.trim() || undefined;
    // Workspace fields are replaced wholesale: the caller composed the list.
    if (patch.checklist !== undefined) post.checklist = patch.checklist;
    if (patch.comments !== undefined) post.comments = patch.comments;
    if (patch.attachments !== undefined) post.attachments = patch.attachments;
    if (patch.timeEntries !== undefined) post.timeEntries = patch.timeEntries;
    if (patch.stageId !== undefined) post.stageId = patch.stageId || undefined;
    post.updatedAt = nowISO();

    this.write(db);
    return post;
  }

  async reschedulePost(id: string, newDate: string): Promise<Post> {
    const db = this.read();
    const post = db.posts.find((p) => p.id === id);
    if (!post) throw new Error("Post não encontrado.");
    if (newDate !== post.date) {
      post.rescheduleHistory = [
        ...post.rescheduleHistory,
        { from: post.date, to: newDate, at: nowISO() },
      ];
      post.date = newDate;
    }
    post.status = "rescheduled";
    post.updatedAt = nowISO();
    this.write(db);
    return post;
  }

  async deletePost(id: string): Promise<Post> {
    const db = this.read();
    const post = db.posts.find((p) => p.id === id);
    if (!post) throw new Error("Post não encontrado.");
    post.status = "deleted";
    post.updatedAt = nowISO();
    this.write(db);
    return post;
  }

  async restorePost(id: string, status: PostStatus = "todo"): Promise<Post> {
    const db = this.read();
    const post = db.posts.find((p) => p.id === id);
    if (!post) throw new Error("Post não encontrado.");
    post.status = status;
    post.updatedAt = nowISO();
    this.write(db);
    return post;
  }

  // ── External review (Spec 03) ─────────────────────────────────
  async requestApproval(postId: string, teamMessage?: string): Promise<Post> {
    const db = this.read();
    const post = db.posts.find((p) => p.id === postId);
    if (!post) throw new Error("Post não encontrado.");
    if (post.status === "deleted")
      throw new Error("Não é possível enviar um post deletado para aprovação.");

    const previous = post.approval;
    post.approval = {
      round: (previous?.round ?? 0) + 1,
      requestedAt: nowISO(),
      teamMessage: teamMessage?.trim() || undefined,
      decisions: previous?.decisions ?? [],
    };
    post.updatedAt = nowISO();
    this.write(db);
    return post;
  }

  /**
   * Resolve a post strictly through its share token. Returning the calendar
   * too lets callers assert the post really belongs to that token — the check
   * that keeps one client from acting on another client's posts.
   */
  private resolveByToken(token: string, postId: string) {
    const db = this.read();
    const calendar = db.calendars.find((c) => c.shareToken === token);
    if (!calendar) throw new Error("Link inválido ou expirado.");
    const post = db.posts.find(
      (p) => p.id === postId && p.calendarId === calendar.id && p.status !== "deleted",
    );
    if (!post) throw new Error("Post não encontrado neste calendário.");
    const client = db.clients.find((c) => c.id === calendar.clientId);
    return { db, calendar, post, client };
  }

  async issueApprovalCode(
    token: string,
    postId: string,
  ): Promise<{ maskedEmail?: string; devCode?: string; delivered?: boolean }> {
    const { db, post, client } = this.resolveByToken(token, postId);
    if (!post.approval || post.approval.round < 1)
      throw new Error("Este post ainda não foi enviado para aprovação.");

    const code = generateApprovalCode();
    db.approvalCodes = (db.approvalCodes ?? []).filter(
      // drop this post's previous codes and anything already expired
      (c) => c.postId !== postId && c.expiresAt > Date.now(),
    );
    db.approvalCodes.push({
      postId,
      token,
      code,
      expiresAt: Date.now() + APPROVAL_CODE_TTL_MS,
    });
    this.write(db);

    // No e-mail transport in the local adapter: hand the code back so the
    // test environment can show it on screen.
    return { maskedEmail: maskEmail(client?.email), devCode: code, delivered: false };
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
    const { db, post } = this.resolveByToken(token, postId);
    if (!post.approval || post.approval.round < 1)
      throw new Error("Este post ainda não foi enviado para aprovação.");

    const invalid = validateDecision(input);
    if (invalid) throw new Error(invalid);

    // Verification is mandatory for link-based decisions (decision A2).
    const entry = (db.approvalCodes ?? []).find(
      (c) => c.postId === postId && c.token === token,
    );
    if (!entry) throw new Error("Solicite um código de verificação primeiro.");
    if (entry.expiresAt <= Date.now()) {
      db.approvalCodes = (db.approvalCodes ?? []).filter((c) => c !== entry);
      this.write(db);
      throw new Error("O código expirou. Solicite um novo.");
    }
    if (!input.code || !codesMatch(entry.code, input.code.trim())) {
      throw new Error("Código incorreto.");
    }

    post.approval.decisions = [
      ...post.approval.decisions,
      {
        id: uid("dec"),
        round: post.approval.round,
        result: input.result,
        comment: input.comment?.trim() || undefined,
        decidedByName: input.decidedByName.trim(),
        verified: true,
        at: nowISO(),
      },
    ];
    post.updatedAt = nowISO();
    // Single use: the code is spent once the decision lands.
    db.approvalCodes = (db.approvalCodes ?? []).filter((c) => c !== entry);
    this.write(db);
  }

  // ── Public share view (isolated + sanitized) ──────────────────
  // ── CRM e orquestrador ────────────────────────────────────────
  async saveDeal(deal: Deal): Promise<Deal> {
    const invalid = validateDeal(deal);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.deals ?? [];
    const next = { ...deal, updatedAt: nowISO() };
    db.deals = list.some((d) => d.id === deal.id)
      ? list.map((d) => (d.id === deal.id ? next : d))
      : [...list, next];
    this.write(db);
    return next;
  }

  async deleteDeal(id: string): Promise<void> {
    const db = this.read();
    db.deals = (db.deals ?? []).filter((d) => d.id !== id);
    // Interactions are the record of what was said to a person. They go with
    // the deal, because keeping them without it would be keeping personal
    // data with no reason to hold it.
    db.interactions = (db.interactions ?? []).filter((i) => i.dealId !== id);
    db.crmTasks = (db.crmTasks ?? []).filter((t) => t.dealId !== id);
    this.write(db);
  }

  async addInteraction(interaction: Interaction): Promise<Interaction> {
    const invalid = validateInteraction(interaction);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    db.interactions = [...(db.interactions ?? []), interaction];
    // The deal's "last contact" follows from the interaction, never the
    // other way round.
    db.deals = (db.deals ?? []).map((d) =>
      d.id === interaction.dealId
        ? { ...d, lastContactOn: interaction.at.slice(0, 10), updatedAt: nowISO() }
        : d,
    );
    this.write(db);
    return interaction;
  }

  // ── Análise de perfil e concorrência ──────────────────────────
  async saveAssessmentTemplate(template: AssessmentTemplate): Promise<AssessmentTemplate> {
    const invalid = validateAssessmentTemplate(template);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.assessmentTemplates ?? [];
    const next = { ...template, updatedAt: nowISO() };
    db.assessmentTemplates = list.some((t) => t.id === template.id)
      ? list.map((t) => (t.id === template.id ? next : t))
      : [...list, next];
    this.write(db);
    return next;
  }

  async saveAssessment(assessment: Assessment): Promise<Assessment> {
    const invalid = validateAssessment(assessment);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.assessments ?? [];
    const next = { ...assessment, updatedAt: nowISO() };
    db.assessments = list.some((a) => a.id === assessment.id)
      ? list.map((a) => (a.id === assessment.id ? next : a))
      : [...list, next];
    this.write(db);
    return next;
  }

  async deleteAssessment(id: string): Promise<void> {
    const db = this.read();
    db.assessments = (db.assessments ?? []).filter((a) => a.id !== id);
    this.write(db);
  }

  // ── Webhooks de saída ─────────────────────────────────────────
  async saveWebhook(subscription: WebhookSubscription): Promise<WebhookSubscription> {
    const invalid = validateSubscription(subscription);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.webhooks ?? [];
    const next = { ...subscription, updatedAt: nowISO() };
    db.webhooks = list.some((w) => w.id === subscription.id)
      ? list.map((w) => (w.id === subscription.id ? next : w))
      : [...list, next];
    this.write(db);
    return next;
  }

  async deleteWebhook(id: string): Promise<void> {
    const db = this.read();
    db.webhooks = (db.webhooks ?? []).filter((w) => w.id !== id);
    db.webhookDeliveries = (db.webhookDeliveries ?? []).filter((d) => d.subscriptionId !== id);
    this.write(db);
  }

  async enqueueWebhookTest(subscriptionId: string): Promise<WebhookDelivery> {
    const db = this.read();
    const subscription = (db.webhooks ?? []).find((w) => w.id === subscriptionId);
    if (!subscription) throw new Error("Assinatura não encontrada.");
    const delivery = newWebhookDelivery(
      subscriptionId,
      subscription.events[0] ?? "post.aprovado",
      buildWebhookPayload(subscription.events[0] ?? "post.aprovado", { teste: true }),
    );
    db.webhookDeliveries = [...(db.webhookDeliveries ?? []), delivery];
    this.write(db);
    return delivery;
  }

  // ── Roteiros ──────────────────────────────────────────────────
  async saveScript(script: Script): Promise<Script> {
    const invalid = validateScript(script);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.scripts ?? [];
    const stored = list.find((s) => s.id === script.id);
    // Optimistic locking: two people on the same script is normal; silently
    // throwing one of them away is not.
    if (stored && stored.version > script.version)
      throw new Error("Alguém salvou este roteiro enquanto você editava. Recarregue para não perder o trabalho dessa pessoa.");
    const next = { ...script, version: script.version + 1, updatedAt: nowISO() };
    db.scripts = stored
      ? list.map((s) => (s.id === script.id ? next : s))
      : [...list, next];
    this.write(db);
    return next;
  }

  async deleteScript(id: string): Promise<void> {
    const db = this.read();
    db.scripts = (db.scripts ?? []).filter((s) => s.id !== id);
    this.write(db);
  }

  // ── Formulários de briefing ───────────────────────────────────
  async saveForm(form: BriefingForm): Promise<BriefingForm> {
    const invalid = validateForm(form);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.forms ?? [];
    const next = { ...form, updatedAt: nowISO() };
    // Editing never touches what people already answered.
    db.forms = list.some((f) => f.id === form.id)
      ? list.map((f) => (f.id === form.id ? next : f))
      : [...list, next];
    this.write(db);
    return next;
  }

  async deleteForm(id: string): Promise<void> {
    const db = this.read();
    db.forms = (db.forms ?? []).filter((f) => f.id !== id);
    db.formResponses = (db.formResponses ?? []).filter((r) => r.formId !== id);
    this.write(db);
  }

  async getPublicForm(token: string): Promise<PublicForm | null> {
    const db = this.read();
    const form = (db.forms ?? []).find((f) => f.shareToken === token);
    // A paused form is indistinguishable from one that never existed.
    if (!form || !isFormOpen(form)) return null;
    return {
      id: form.id,
      title: form.title,
      description: form.description,
      questions: form.questions,
    };
  }

  async submitForm(
    token: string,
    answers: Record<string, string | string[] | number>,
    respondent?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const db = this.read();
    const form = (db.forms ?? []).find((f) => f.shareToken === token);
    if (!form || !isFormOpen(form)) return { ok: false, reason: "Formulário indisponível." };
    const problems = validateAnswers(form, answers);
    const first = Object.values(problems)[0];
    if (first) return { ok: false, reason: first };
    const response: FormResponse = {
      id: uid("resp"),
      formId: form.id,
      answers,
      respondent: respondent?.trim() || undefined,
      at: nowISO(),
    };
    db.formResponses = [...(db.formResponses ?? []), response];
    this.write(db);
    return { ok: true };
  }

  // ── Conciliação de extrato ────────────────────────────────────
  async saveStatementLines(lines: StatementLine[]): Promise<StatementLine[]> {
    const db = this.read();
    const byId = new Map((db.statementLines ?? []).map((l) => [l.id, l]));
    for (const line of lines) byId.set(line.id, line);
    db.statementLines = [...byId.values()];
    this.write(db);
    return lines;
  }

  async deleteStatementLine(id: string): Promise<void> {
    const db = this.read();
    db.statementLines = (db.statementLines ?? []).filter((l) => l.id !== id);
    this.write(db);
  }

  // ── Projetos e squads ─────────────────────────────────────────
  async saveProject(project: Project): Promise<Project> {
    const invalid = validateProject(project);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    if (!db.clients.some((c) => c.id === project.clientId))
      throw new Error("Cliente não encontrado.");
    const list = db.projects ?? [];
    const next = { ...project, updatedAt: nowISO() };
    db.projects = list.some((p) => p.id === project.id)
      ? list.map((p) => (p.id === project.id ? next : p))
      : [...list, next];
    this.write(db);
    return next;
  }

  async deleteProject(id: string): Promise<void> {
    const db = this.read();
    db.projects = (db.projects ?? []).filter((p) => p.id !== id);
    // The work stays: cards and entries only lose the project they pointed
    // at. Removing a cost centre must not remove the costs.
    db.posts = db.posts.map((p) => (p.projectId === id ? { ...p, projectId: undefined } : p));
    db.entries = (db.entries ?? []).map((e) =>
      e.projectId === id ? { ...e, projectId: undefined } : e,
    );
    this.write(db);
  }

  async saveSquad(squad: Squad): Promise<Squad> {
    const invalid = validateSquad(squad);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.squads ?? [];
    const next = { ...squad, updatedAt: nowISO() };
    db.squads = list.some((s) => s.id === squad.id)
      ? list.map((s) => (s.id === squad.id ? next : s))
      : [...list, next];
    this.write(db);
    return next;
  }

  async deleteSquad(id: string): Promise<void> {
    const db = this.read();
    db.squads = (db.squads ?? []).filter((s) => s.id !== id);
    // Projects outlive the squad; they just have no squad (ficha 14).
    db.projects = (db.projects ?? []).map((p) =>
      p.squadId === id ? { ...p, squadId: undefined } : p,
    );
    this.write(db);
  }

  async saveHealthWeights(weights: HealthWeights): Promise<void> {
    const invalid = validateWeights(weights);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    db.healthWeights = weights;
    this.write(db);
  }

  // ── Dossiê estratégico ────────────────────────────────────────
  async saveDossierTemplate(template: DossierTemplate): Promise<DossierTemplate> {
    const invalid = validateTemplate(template);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.dossierTemplates ?? [];
    const next = { ...template, updatedAt: nowISO() };
    db.dossierTemplates = list.some((t) => t.id === template.id)
      ? list.map((t) => (t.id === template.id ? next : t))
      : [...list, next];
    this.write(db);
    return next;
  }

  async saveDossier(dossier: Dossier): Promise<Dossier> {
    const db = this.read();
    if (!db.clients.some((c) => c.id === dossier.clientId))
      throw new Error("Cliente não encontrado.");
    const list = db.dossiers ?? [];
    const next = { ...dossier, updatedAt: nowISO() };
    db.dossiers = list.some((d) => d.id === dossier.id)
      ? list.map((d) => (d.id === dossier.id ? next : d))
      : [...list, next];
    this.write(db);
    return next;
  }

  async getPublicDossier(token: string): Promise<PublicDossier | null> {
    const db = this.read();
    const dossier = (db.dossiers ?? []).find((d) => d.shareToken === token);
    // A paused link has to look exactly like a link that never existed.
    if (!dossier || !dossier.shareEnabled) return null;
    const template = (db.dossierTemplates ?? []).find((t) => t.id === dossier.templateId);
    const client = db.clients.find((c) => c.id === dossier.clientId);
    if (!template || !client) return null;
    const { defs, sections } = publicSections(dossier, template);
    return {
      client: { name: client.name, logoUrl: client.logoUrl, color: client.color },
      template: { name: template.name, sections: defs },
      sections,
    };
  }

  // ── Pauta única e planejamento mensal ─────────────────────────
  async savePlan(plan: MonthlyPlan): Promise<MonthlyPlan> {
    const invalid = validatePlan(plan);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.plans ?? [];
    const clash = list.find(
      (p) => p.id !== plan.id && p.clientId === plan.clientId && p.month === plan.month,
    );
    // One plan per client per month: two would be two sources of truth for
    // the same pillars, and the pauta reads from one of them.
    if (clash) throw new Error("Este cliente já tem planejamento para este mês.");
    const next = { ...plan, updatedAt: nowISO() };
    db.plans = list.some((p) => p.id === plan.id)
      ? list.map((p) => (p.id === plan.id ? next : p))
      : [...list, next];
    this.write(db);
    return next;
  }

  async deletePlan(id: string): Promise<void> {
    const db = this.read();
    db.plans = (db.plans ?? []).filter((p) => p.id !== id);
    this.write(db);
  }

  async savePautaItems(items: PautaItem[]): Promise<PautaItem[]> {
    const db = this.read();
    const list = db.pautaItems ?? [];
    const byId = new Map(list.map((i) => [i.id, i]));
    const saved: PautaItem[] = [];
    for (const item of items) {
      const invalid = validatePautaItem(item);
      if (invalid) throw new Error(invalid);
      const next = { ...item, updatedAt: nowISO() };
      byId.set(item.id, next);
      saved.push(next);
    }
    db.pautaItems = [...byId.values()];
    this.write(db);
    return saved;
  }

  async deletePautaItems(ids: string[]): Promise<void> {
    const db = this.read();
    const gone = new Set(ids);
    db.pautaItems = (db.pautaItems ?? []).filter((i) => !gone.has(i.id));
    this.write(db);
  }

  // ── Banco de ideias ───────────────────────────────────────────
  async saveIdea(idea: Idea): Promise<Idea> {
    if (!idea.text.trim()) throw new Error("Escreva a ideia.");
    const db = this.read();
    const list = db.ideas ?? [];
    db.ideas = list.some((i) => i.id === idea.id)
      ? list.map((i) => (i.id === idea.id ? idea : i))
      : [...list, idea];
    this.write(db);
    return idea;
  }

  async deleteIdea(id: string): Promise<void> {
    const db = this.read();
    db.ideas = (db.ideas ?? []).filter((i) => i.id !== id);
    // The cards an idea produced stay where they are; they only lose the
    // back-reference, so nothing in the calendar disappears with the idea.
    db.posts = db.posts.map((p) => (p.ideaId === id ? { ...p, ideaId: undefined } : p));
    this.write(db);
  }

  async saveCrmTask(task: CrmTask): Promise<CrmTask> {
    if (!task.title.trim()) throw new Error("Dê um título à tarefa.");
    const db = this.read();
    const list = db.crmTasks ?? [];
    db.crmTasks = list.some((t) => t.id === task.id)
      ? list.map((t) => (t.id === task.id ? task : t))
      : [...list, task];
    this.write(db);
    return task;
  }

  async deleteCrmTask(id: string): Promise<void> {
    const db = this.read();
    db.crmTasks = (db.crmTasks ?? []).filter((t) => t.id !== id);
    this.write(db);
  }

  async saveBlock(block: ContactBlock): Promise<ContactBlock> {
    if (!block.value.trim()) throw new Error("Informe o contato a bloquear.");
    const db = this.read();
    const list = db.blocks ?? [];
    db.blocks = list.some((b) => b.id === block.id)
      ? list.map((b) => (b.id === block.id ? block : b))
      : [...list, block];
    this.write(db);
    return block;
  }

  async deleteBlock(id: string): Promise<void> {
    const db = this.read();
    db.blocks = (db.blocks ?? []).filter((b) => b.id !== id);
    this.write(db);
  }

  async saveProcess(process: ContractingProcess): Promise<ContractingProcess> {
    const db = this.read();
    const list = db.processes ?? [];
    db.processes = list.some((p) => p.id === process.id)
      ? list.map((p) => (p.id === process.id ? process : p))
      : [...list, process];
    this.write(db);
    return process;
  }

  // ── Financeiro ────────────────────────────────────────────────
  async saveAccount(account: FinanceAccount): Promise<FinanceAccount> {
    if (!account.name.trim()) throw new Error("Dê um nome à conta.");
    const db = this.read();
    const list = db.accounts ?? [];
    db.accounts = list.some((a) => a.id === account.id)
      ? list.map((a) => (a.id === account.id ? account : a))
      : [...list, account];
    this.write(db);
    return account;
  }

  async deleteAccount(id: string): Promise<void> {
    const db = this.read();
    // An account that has moved is history. It is deactivated, never removed.
    if (accountHasMovement(id, db.entries ?? [], db.transfers ?? [])) {
      throw new Error("Esta conta tem movimento. Desative-a em vez de excluir.");
    }
    db.accounts = (db.accounts ?? []).filter((a) => a.id !== id);
    this.write(db);
  }

  async saveCategory(category: FinanceCategory): Promise<FinanceCategory> {
    if (!category.name.trim()) throw new Error("Dê um nome à categoria.");
    const db = this.read();
    const list = db.categories ?? [];
    db.categories = list.some((c) => c.id === category.id)
      ? list.map((c) => (c.id === category.id ? category : c))
      : [...list, category];
    this.write(db);
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    const db = this.read();
    if ((db.entries ?? []).some((e) => e.categoryId === id)) {
      throw new Error("Há lançamentos nesta categoria. Desative-a em vez de excluir.");
    }
    db.categories = (db.categories ?? []).filter((c) => c.id !== id);
    this.write(db);
  }

  async saveEntry(entry: FinanceEntry): Promise<FinanceEntry> {
    const invalid = validateEntry(entry);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.entries ?? [];
    const current = list.find((e) => e.id === entry.id);
    // A settled entry's value is never edited: correcting it means reversing.
    if (current && !canEditAmount(current) && current.amount !== entry.amount) {
      throw new Error("Um lançamento liquidado não muda de valor. Estorne-o.");
    }
    db.entries = current
      ? list.map((e) => (e.id === entry.id ? entry : e))
      : [...list, entry];
    this.write(db);
    return entry;
  }

  async deleteEntry(id: string): Promise<void> {
    const db = this.read();
    const current = (db.entries ?? []).find((e) => e.id === id);
    if (!current) return;
    if (current.status === "liquidado")
      throw new Error("Um lançamento liquidado não é removido. Estorne-o.");
    db.entries = (db.entries ?? []).filter((e) => e.id !== id);
    this.write(db);
  }

  async settleEntry(id: string, accountId: string, date: string): Promise<FinanceEntry> {
    const db = this.read();
    const list = db.entries ?? [];
    const current = list.find((e) => e.id === id);
    if (!current) throw new Error("Lançamento não encontrado.");
    if (!canTransitionEntry(current.status, "liquidado"))
      throw new Error("Este lançamento não pode ser liquidado agora.");
    if (!accountId) throw new Error("Escolha a conta.");

    const next: FinanceEntry = {
      ...current,
      status: "liquidado",
      settledAt: date,
      accountId,
    };
    db.entries = list.map((e) => (e.id === id ? next : e));
    this.write(db);
    return next;
  }

  async unsettleEntry(id: string): Promise<FinanceEntry> {
    const db = this.read();
    const list = db.entries ?? [];
    const current = list.find((e) => e.id === id);
    if (!current) throw new Error("Lançamento não encontrado.");
    if (current.status !== "liquidado") throw new Error("Este lançamento não está liquidado.");
    const next: FinanceEntry = { ...current, status: "pendente", settledAt: undefined };
    db.entries = list.map((e) => (e.id === id ? next : e));
    this.write(db);
    return next;
  }

  async reverseEntry(id: string): Promise<FinanceEntry> {
    const db = this.read();
    const list = db.entries ?? [];
    const current = list.find((e) => e.id === id);
    if (!current) throw new Error("Lançamento não encontrado.");
    if (current.status !== "liquidado")
      throw new Error("Só um lançamento liquidado é estornado.");
    const reversal = buildReversal(current, uid("fin"));
    db.entries = [...list, reversal];
    this.write(db);
    return reversal;
  }

  async saveSeries(series: FinanceSeries): Promise<FinanceSeries> {
    const invalid = validateSeries(series);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.series ?? [];
    db.series = list.some((s) => s.id === series.id)
      ? list.map((s) => (s.id === series.id ? series : s))
      : [...list, series];
    this.write(db);
    return series;
  }

  async deleteSeries(id: string): Promise<void> {
    const db = this.read();
    db.series = (db.series ?? []).filter((s) => s.id !== id);
    // Rows already materialised but still open go with it; settled ones stay,
    // because they happened.
    db.entries = (db.entries ?? []).filter(
      (e) => e.seriesId !== id || e.status === "liquidado",
    );
    this.write(db);
  }

  async materialiseSeries(): Promise<number> {
    const db = this.read();
    const due = dueForMaterialisation(db.series ?? [], db.entries ?? []);
    if (due.length === 0) return 0;
    db.entries = [
      ...(db.entries ?? []),
      ...due.map((e) => ({ ...e, id: uid("fin"), createdAt: nowISO() })),
    ];
    this.write(db);
    return due.length;
  }

  async saveTransfer(transfer: Transfer): Promise<Transfer> {
    const invalid = validateTransfer(transfer);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const list = db.transfers ?? [];
    db.transfers = list.some((t) => t.id === transfer.id)
      ? list.map((t) => (t.id === transfer.id ? transfer : t))
      : [...list, transfer];
    this.write(db);
    return transfer;
  }

  async deleteTransfer(id: string): Promise<void> {
    const db = this.read();
    db.transfers = (db.transfers ?? []).filter((t) => t.id !== id);
    this.write(db);
  }

  // ── Catálogo ──────────────────────────────────────────────────
  async createService(input: Omit<Service, "id" | "createdAt">): Promise<Service> {
    const invalid = validateService(input);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const service: Service = {
      ...input,
      name: input.name.trim(),
      id: uid("svc"),
      createdAt: nowISO(),
    };
    db.services = [...(db.services ?? []), service];
    this.write(db);
    return service;
  }

  async updateService(id: string, patch: Partial<Service>): Promise<Service> {
    const db = this.read();
    const list = db.services ?? [];
    const current = list.find((s) => s.id === id);
    if (!current) throw new Error("Serviço não encontrado.");
    const next: Service = { ...current, ...patch };
    const invalid = validateService(next);
    if (invalid) throw new Error(invalid);
    db.services = list.map((s) => (s.id === id ? next : s));
    this.write(db);
    return next;
  }

  async deleteService(id: string): Promise<void> {
    const db = this.read();
    db.services = (db.services ?? []).filter((s) => s.id !== id);
    // Proposals keep their items: they are the record of what was offered.
    this.write(db);
  }

  // ── Propostas ─────────────────────────────────────────────────
  async saveProposal(proposal: Proposal): Promise<Proposal> {
    const db = this.read();
    const list = db.proposals ?? [];
    const current = list.find((p) => p.id === proposal.id);
    // An accepted proposal is what was agreed. It never changes again.
    if (current && !isEditable(current))
      throw new Error("Uma proposta aceita não pode ser alterada.");

    const invalid = validateProposal(proposal);
    if (invalid) throw new Error(invalid);

    const next: Proposal = { ...proposal, updatedAt: nowISO() };
    db.proposals = current
      ? list.map((p) => (p.id === proposal.id ? next : p))
      : [...list, next];
    this.write(db);
    return next;
  }

  async sendProposal(id: string): Promise<Proposal> {
    const db = this.read();
    const list = db.proposals ?? [];
    const current = list.find((p) => p.id === id);
    if (!current) throw new Error("Proposta não encontrada.");
    if (!canTransition(current.status, "enviada"))
      throw new Error("Esta proposta não pode ser enviada agora.");

    const next: Proposal = {
      ...current,
      // The number is handed out on the first send, never on a draft: a
      // number given to something abandoned leaves a hole to explain.
      number: current.number ?? nextProposalNumber(list),
      status: "enviada",
      sentAt: nowISO(),
      version: current.status === "ajuste_pedido" ? current.version + 1 : current.version,
      updatedAt: nowISO(),
    };
    db.proposals = list.map((p) => (p.id === id ? next : p));
    this.write(db);
    return next;
  }

  async deleteProposal(id: string): Promise<void> {
    const db = this.read();
    const current = (db.proposals ?? []).find((p) => p.id === id);
    if (!current) return;
    if (current.status !== "rascunho" && current.status !== "arquivada")
      throw new Error("Só rascunhos e propostas arquivadas podem ser excluídos.");
    db.proposals = (db.proposals ?? []).filter((p) => p.id !== id);
    this.write(db);
  }

  // ── Contratos ─────────────────────────────────────────────────
  async saveContract(contract: Contract): Promise<Contract> {
    const db = this.read();
    const list = db.contracts ?? [];
    const current = list.find((c) => c.id === contract.id);
    if (current && !canEditText(current) && current.finalText !== contract.finalText) {
      throw new Error(
        "O texto não pode mudar depois da primeira assinatura. Cancele e gere outro contrato.",
      );
    }
    db.contracts = current
      ? list.map((c) => (c.id === contract.id ? contract : c))
      : [...list, contract];
    this.write(db);
    return contract;
  }

  async deleteContract(id: string): Promise<void> {
    const db = this.read();
    const current = (db.contracts ?? []).find((c) => c.id === id);
    if (!current) return;
    if (current.signatures.length > 0)
      throw new Error("Um contrato com assinatura nunca é removido. Cancele-o.");
    db.contracts = (db.contracts ?? []).filter((c) => c.id !== id);
    this.write(db);
  }

  // ── Páginas públicas de proposta e contrato ───────────────────
  async getPublicProposal(linkId: string): Promise<Proposal | null> {
    const db = this.read();
    const proposal = (db.proposals ?? []).find((p) => p.linkId === linkId);
    // A draft has no public life, and an archived one is gone.
    if (!proposal || proposal.status === "rascunho" || proposal.status === "arquivada")
      return null;

    // Opening it is a fact worth keeping (spec 06: `visualizacao_proposta`).
    const view = {
      id: uid("view"),
      at: nowISO(),
      agent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
    };
    const updated = { ...proposal, views: [...proposal.views, view] };
    db.proposals = (db.proposals ?? []).map((p) => (p.id === proposal.id ? updated : p));
    this.write(db);
    return updated;
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
    const db = this.read();
    const list = db.proposals ?? [];
    const proposal = list.find((p) => p.linkId === linkId);
    if (!proposal) throw new Error("Proposta não encontrada.");
    if (!input.deciderName.trim()) throw new Error("Informe seu nome.");
    if (input.result !== "aceita" && !input.reason?.trim())
      throw new Error("Conte o motivo para a agência saber como ajustar.");

    // Accepting something that has lapsed is refused at the link, as the
    // spec requires: the price on screen may no longer be the price.
    if (isExpired(proposal)) throw new Error("Esta proposta venceu. Peça uma nova à agência.");
    if (!canTransition(proposal.status, input.result))
      throw new Error("Esta proposta não aceita mais decisões.");

    db.proposals = list.map((p) =>
      p.id === proposal.id
        ? {
            ...p,
            status: input.result,
            decidedAt: nowISO(),
            deciderName: input.deciderName.trim(),
            deciderDocument: input.deciderDocument?.trim() || undefined,
            refusalReason: input.reason?.trim() || undefined,
            updatedAt: nowISO(),
          }
        : p,
    );
    this.write(db);
  }

  async getPublicContract(partyToken: string) {
    const db = this.read();
    for (const contract of db.contracts ?? []) {
      const party = contract.parties.find((p) => p.token === partyToken);
      // A draft has no parties to show and a cancelled one is not signable.
      if (!party || contract.status === "rascunho" || contract.status === "cancelado")
        continue;
      return { contract, partyId: party.id };
    }
    return null;
  }

  async signContract(
    partyToken: string,
    input: { typedName: string; typedDocument: string },
  ): Promise<void> {
    const invalid = validateSignature(input);
    if (invalid) throw new Error(invalid);

    const db = this.read();
    const list = db.contracts ?? [];
    const contract = list.find((c) => c.parties.some((p) => p.token === partyToken));
    if (!contract) throw new Error("Contrato não encontrado.");
    const party = contract.parties.find((p) => p.token === partyToken)!;
    if (contract.status === "cancelado") throw new Error("Este contrato foi cancelado.");
    if (hasSigned(contract, party.id)) throw new Error("Esta parte já assinou.");

    const signature = {
      id: uid("sig"),
      partyId: party.id,
      typedName: input.typedName.trim(),
      typedDocument: input.typedDocument.replace(/\D/g, ""),
      at: nowISO(),
      agent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
      // The hash of the text as it stands right now. If the text were ever
      // changed afterwards, this is what would expose it.
      signedTextHash: contract.textHash,
    };
    const signed: Contract = { ...contract, signatures: [...contract.signatures, signature] };
    const status = deriveStatus(signed);
    db.contracts = list.map((c) =>
      c.id === contract.id
        ? {
            ...signed,
            status,
            effectiveAt:
              status === "vigente" && !signed.effectiveAt ? nowISO() : signed.effectiveAt,
          }
        : c,
    );
    this.write(db);
  }

  // ── Agenda ────────────────────────────────────────────────────
  async createAppointment(
    input: Omit<Appointment, "id" | "createdAt">,
  ): Promise<Appointment> {
    const invalid = validateAppointment(input);
    if (invalid) throw new Error(invalid);
    const db = this.read();
    const appointment: Appointment = {
      ...input,
      title: input.title.trim(),
      id: uid("appt"),
      createdAt: nowISO(),
    };
    db.appointments = [...(db.appointments ?? []), appointment];
    this.write(db);
    return appointment;
  }

  async updateAppointment(
    id: string,
    patch: Partial<Appointment>,
  ): Promise<Appointment> {
    const db = this.read();
    const list = db.appointments ?? [];
    const current = list.find((a) => a.id === id);
    if (!current) throw new Error("Compromisso não encontrado.");
    const next: Appointment = { ...current, ...patch };
    const invalid = validateAppointment(next);
    if (invalid) throw new Error(invalid);
    db.appointments = list.map((a) => (a.id === id ? next : a));
    this.write(db);
    return next;
  }

  async addMarkedDate(date: MarkedDate): Promise<void> {
    const db = this.read();
    const list = db.markedDates ?? [];
    if (list.some((d) => d.id === date.id)) return; // already kept
    db.markedDates = [...list, date];
    this.write(db);
  }

  async removeMarkedDate(id: string): Promise<void> {
    const db = this.read();
    db.markedDates = (db.markedDates ?? []).filter((d) => d.id !== id);
    this.write(db);
  }

  async saveBookingConfig(input: {
    availability: Availability;
    page: Pick<BookingPage, "active" | "title" | "intro">;
  }): Promise<void> {
    const db = this.read();
    db.availability = input.availability;
    db.bookingPage = {
      ...(db.bookingPage ?? { linkId: shareToken(), active: false, title: "" }),
      ...input.page,
    };
    this.write(db);
  }

  async regenerateBookingLink(): Promise<BookingPage> {
    const db = this.read();
    const page: BookingPage = {
      ...(db.bookingPage ?? { active: false, title: "Agendar uma conversa" }),
      linkId: shareToken(),
    };
    db.bookingPage = page;
    this.write(db);
    return page;
  }

  // ── Public booking ────────────────────────────────────────────
  /** Resolves the page only while it is active — paused behaves as missing. */
  private livePage(linkId: string) {
    const db = this.read();
    const page = db.bookingPage;
    if (!page || !page.active || page.linkId !== linkId) return null;
    return { db, page, availability: db.availability ?? DEFAULT_AVAILABILITY };
  }

  async getPublicBookingPage(linkId: string) {
    const live = this.livePage(linkId);
    return live ? { page: live.page, availability: live.availability } : null;
  }

  async getPublicBusy(linkId: string, from: string, to: string) {
    const live = this.livePage(linkId);
    if (!live) return null;
    const within = (iso: string) => iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;
    // Start and end only. Who the agency is with is none of the visitor's business.
    return [
      ...(live.db.appointments ?? [])
        .filter((a) => a.status === "marcado" && within(a.start))
        .map((a) => ({ start: a.start, end: a.end })),
      ...(live.db.bookings ?? [])
        .filter((b) => b.status === "confirmada" && within(b.start))
        .map((b) => ({ start: b.start, end: b.end })),
    ].sort((a, b) => a.start.localeCompare(b.start));
  }

  async createPublicBooking(
    linkId: string,
    input: { name: string; email: string; start: string; note?: string },
  ) {
    const live = this.livePage(linkId);
    if (!live) throw new Error("Página de agendamento indisponível.");
    const invalid = validateBooking(input);
    if (invalid) throw new Error(invalid);

    const { availability } = live;
    const start = new Date(input.start);
    if (start.getTime() < Date.now() + availability.noticeHours * 3600_000) {
      throw new Error("Esse horário está dentro da antecedência mínima.");
    }
    const end = new Date(start.getTime() + availability.durationMinutes * 60_000);
    const slot = { start: input.start, end: end.toISOString() };

    // Re-read right before writing: the window between offering a slot and
    // taking it is exactly where a double booking happens.
    const db = this.read();
    const busy = [
      ...(db.appointments ?? [])
        .filter((a) => a.status === "marcado")
        .map((a) => ({ start: a.start, end: a.end })),
      ...(db.bookings ?? [])
        .filter((b) => b.status === "confirmada")
        .map((b) => ({ start: b.start, end: b.end })),
    ];
    if (hasConflict(slot, busy)) {
      throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");
    }

    const manageToken = shareToken();
    const booking: Booking = {
      id: uid("book"),
      pageId: live.page.linkId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      start: slot.start,
      end: slot.end,
      status: "confirmada",
      manageToken,
      note: input.note?.trim() || undefined,
      createdAt: nowISO(),
    };
    db.bookings = [...(db.bookings ?? []), booking];
    db.appointments = [
      ...(db.appointments ?? []),
      {
        id: uid("appt"),
        title: `${booking.name} (reserva)`,
        description: booking.email,
        start: booking.start,
        end: booking.end,
        status: "marcado",
        source: "reserva",
        createdAt: nowISO(),
      },
    ];
    this.write(db);
    return { manageToken, start: booking.start, end: booking.end };
  }

  async cancelPublicBooking(manageToken: string): Promise<void> {
    const db = this.read();
    const booking = (db.bookings ?? []).find((b) => b.manageToken === manageToken);
    if (!booking) throw new Error("Reserva não encontrada.");
    db.bookings = (db.bookings ?? []).map((b) =>
      b.id === booking.id ? { ...b, status: "cancelada" as const } : b,
    );
    db.appointments = (db.appointments ?? []).map((a) =>
      a.source === "reserva" && a.start === booking.start && a.end === booking.end
        ? { ...a, status: "cancelado" as const }
        : a,
    );
    this.write(db);
  }

  // ── Board columns ─────────────────────────────────────────────
  async createBoardStage(input: Omit<BoardStage, "id">): Promise<BoardStage> {
    const db = this.read();
    if (!db.calendars.some((c) => c.id === input.calendarId)) {
      throw new Error("Calendário não encontrado.");
    }
    const stage: BoardStage = { ...input, id: uid("stage"), name: input.name.trim() };
    db.boardStages = [...(db.boardStages ?? []), stage];
    this.write(db);
    return stage;
  }

  async updateBoardStage(
    id: string,
    patch: Partial<Pick<BoardStage, "name" | "color" | "category" | "order">>,
  ): Promise<BoardStage> {
    const db = this.read();
    const stages = db.boardStages ?? [];
    const stage = stages.find((s) => s.id === id);
    if (!stage) throw new Error("Coluna não encontrada.");
    const next: BoardStage = {
      ...stage,
      ...patch,
      name: (patch.name ?? stage.name).trim(),
    };
    db.boardStages = stages.map((s) => (s.id === id ? next : s));
    this.write(db);
    return next;
  }

  async deleteBoardStage(id: string): Promise<void> {
    const db = this.read();
    db.boardStages = (db.boardStages ?? []).filter((s) => s.id !== id);
    // Cards that pointed at it keep their status and fall back to another
    // column of the same category — see stageForPost.
    db.posts = db.posts.map((p) => (p.stageId === id ? { ...p, stageId: undefined } : p));
    this.write(db);
  }

  async reorderBoardStages(order: { id: string; order: number }[]): Promise<void> {
    const db = this.read();
    const byId = new Map(order.map((o) => [o.id, o.order]));
    db.boardStages = (db.boardStages ?? []).map((s) =>
      byId.has(s.id) ? { ...s, order: byId.get(s.id)! } : s,
    );
    this.write(db);
  }

  // ── Stage automations ─────────────────────────────────────────
  async createAutomationRule(
    input: Omit<AutomationRule, "id" | "createdAt">,
  ): Promise<AutomationRule> {
    const db = this.read();
    if (!db.calendars.some((c) => c.id === input.calendarId)) {
      throw new Error("Calendário não encontrado.");
    }
    const invalid = validateRule(input);
    if (invalid) throw new Error(invalid);

    const rule: AutomationRule = { ...input, id: uid("rule"), createdAt: nowISO() };
    db.automationRules = [...(db.automationRules ?? []), rule];
    this.write(db);
    return rule;
  }

  async updateAutomationRule(
    id: string,
    patch: Partial<Pick<AutomationRule, "active" | "trigger" | "action">>,
  ): Promise<AutomationRule> {
    const db = this.read();
    const rules = db.automationRules ?? [];
    const rule = rules.find((r) => r.id === id);
    if (!rule) throw new Error("Regra não encontrada.");

    const next: AutomationRule = { ...rule, ...patch };
    // Re-validate: a rule edited into nonsense is as bad as one created that way.
    const invalid = validateRule(next);
    if (invalid) throw new Error(invalid);

    db.automationRules = rules.map((r) => (r.id === id ? next : r));
    this.write(db);
    return next;
  }

  async deleteAutomationRule(id: string): Promise<void> {
    const db = this.read();
    db.automationRules = (db.automationRules ?? []).filter((r) => r.id !== id);
    // The log stays: it is the record of what already happened to real posts.
    this.write(db);
  }

  async logAutomationRun(run: AutomationRun): Promise<void> {
    const db = this.read();
    const log = db.automationRuns ?? [];
    // Append-only, and bounded so the demo blob cannot grow without end.
    db.automationRuns = [...log, run].slice(-AUTOMATION_LOG_MAX);
    this.write(db);
  }

  async findAutomationRuns(eventKeys: string[]): Promise<AutomationRun[]> {
    if (eventKeys.length === 0) return [];
    const wanted = new Set(eventKeys);
    const db = this.read();
    return (db.automationRuns ?? []).filter((r) => r.eventKey && wanted.has(r.eventKey));
  }

  async listAutomationRuns(calendarId: string, limit = 50): Promise<AutomationRun[]> {
    const db = this.read();
    const postIds = new Set(
      db.posts.filter((p) => p.calendarId === calendarId).map((p) => p.id),
    );
    return (db.automationRuns ?? [])
      .filter((r) => postIds.has(r.postId))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  }

  async getPublicView(token: string): Promise<PublicCalendarView | null> {
    const db = this.read();
    const calendar = db.calendars.find((c) => c.shareToken === token);
    if (!calendar) return null;
    const client = db.clients.find((c) => c.id === calendar.clientId);
    if (!client) return null;

    const posts = db.posts
      .filter((p) => p.calendarId === calendar.id && p.status !== "deleted")
      // Strip every internal field. Destructuring here is deliberate: a new
      // internal field added to Post shows up in this list as a compile
      // error on PublicPost, instead of quietly leaking.
      .map(
        ({
          internalNotes: _internal,
          checklist: _checklist,
          comments: _comments,
          attachments: _attachments,
          timeEntries: _time,
          stageId: _stage,
          ideaId: _idea,
          ...rest
        }) => rest,
      );

    return {
      calendar: {
        id: calendar.id,
        name: calendar.name,
        shareToken: calendar.shareToken,
      },
      client: {
        id: client.id,
        name: client.name,
        color: client.color,
        logoUrl: client.logoUrl,
        handle: client.handle,
        // masked only — the real address never crosses into the public view
        maskedEmail: maskEmail(client.email),
      },
      posts,
    };
  }
}
