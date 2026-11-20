import type { AutomationRule, AutomationRun } from "../automation";
import type {
  Appointment,
  ApprovalResult,
  ContactBlock,
  Contract,
  ContractingProcess,
  CrmTask,
  Idea,
  MonthlyPlan,
  PautaItem,
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

/**
 * Storage-agnostic data access contract.
 *
 * The app ships with a localStorage adapter (demo / single-device) and can be
 * pointed at a Supabase adapter for production (real multi-device sharing +
 * row-level-security isolation). See docs/EDITORIAL_CALENDAR.md.
 *
 * Isolation guarantee: `getPublicView` is the ONLY method a client-facing route
 * calls. It returns a single calendar, strips internal notes, and hides deleted
 * posts — no method exposes the list of clients/calendars to a token holder.
 */
export interface DataService {
  /** Human-readable adapter name (e.g. "localStorage", "supabase"). */
  readonly name: string;

  // ── Admin auth ────────────────────────────────────────────────
  /** Synchronous read of the cached session (may be stale before init). */
  getSession(): Session | null;
  /**
   * Resolve the current session asynchronously (rehydrating / refreshing
   * tokens where the backend requires it). Optional — falls back to
   * getSession(). Called once on app mount.
   */
  initSession?(): Promise<Session | null>;
  login(email: string, password: string): Promise<Session>;
  logout(): void;

  // ── Admin reads ───────────────────────────────────────────────
  /** Full dataset for the authenticated admin. */
  /** Everything the admin app renders, including the automation rules. */
  getDatabase(): Promise<Database>;

  // ── Clients (each client owns exactly one calendar) ───────────
  createClient(
    input: CreateClientInput,
  ): Promise<{ client: Client; calendar: Calendar }>;
  updateClient(id: string, patch: UpdateClientInput): Promise<Client>;

  // ── Calendars ─────────────────────────────────────────────────
  regenerateShareToken(calendarId: string): Promise<Calendar>;

  // ── Posts ─────────────────────────────────────────────────────
  createPost(input: CreatePostInput): Promise<Post>;
  updatePost(id: string, patch: UpdatePostInput): Promise<Post>;
  /** Move a post to a new day, recording the change in its history. */
  reschedulePost(id: string, newDate: string): Promise<Post>;
  /** Soft delete — the post stays in storage marked as `deleted`. */
  deletePost(id: string): Promise<Post>;
  /** Restore a soft-deleted post to the given status (default `todo`). */
  restorePost(id: string, status?: PostStatus): Promise<Post>;

  // ── External review (Spec 03) ─────────────────────────────────
  /** Admin: send a post to the client, opening a new review round. */
  requestApproval(postId: string, teamMessage?: string): Promise<Post>;

  /**
   * Public: issue a verification code for a decision taken through the share
   * link. Returns the masked destination.
   *
   * `delivered` says whether the code actually left for the client's inbox.
   * False means it exists but nobody received it — the UI must say so rather
   * than leave the client waiting for an e-mail that is not coming.
   * `devCode` is only populated by the local adapter (test environment).
   */
  issueApprovalCode(
    token: string,
    postId: string,
  ): Promise<{ maskedEmail?: string; devCode?: string; delivered?: boolean }>;

  /**
   * Public: record the client's decision. Implementations must verify the
   * code and must never accept a post that does not belong to `token`.
   */
  submitApprovalDecision(
    token: string,
    postId: string,
    input: {
      result: ApprovalResult;
      comment?: string;
      decidedByName: string;
      code?: string;
    },
  ): Promise<void>;

  // ── Board columns (admin only) ────────────────────────────────
  /**
   * Custom columns for one calendar's board. A calendar with none uses the
   * four standard stages, so these are purely additive: nothing that reads
   * `post.status` is affected by them.
   */
  createBoardStage(input: Omit<BoardStage, "id">): Promise<BoardStage>;
  updateBoardStage(
    id: string,
    patch: Partial<Pick<BoardStage, "name" | "color" | "category" | "order">>,
  ): Promise<BoardStage>;
  deleteBoardStage(id: string): Promise<void>;
  /** Persist a new order in one go, so the board never renders half-sorted. */
  reorderBoardStages(order: { id: string; order: number }[]): Promise<void>;

  // ── Stage automations (admin only) ────────────────────────────
  /**
   * Rules and their execution log are admin-only on purpose: a share-link
   * holder must never see how the agency's pipeline is wired, let alone
   * change it. None of these methods is reachable from a client route.
   */
  createAutomationRule(
    input: Omit<AutomationRule, "id" | "createdAt">,
  ): Promise<AutomationRule>;
  updateAutomationRule(
    id: string,
    patch: Partial<Pick<AutomationRule, "active" | "trigger" | "action">>,
  ): Promise<AutomationRule>;
  deleteAutomationRule(id: string): Promise<void>;
  /** Appends to the insert-only log. Never updates or deletes a past run. */
  logAutomationRun(run: AutomationRun): Promise<void>;
  /** Most recent runs for a calendar, newest first. */
  listAutomationRuns(calendarId: string, limit?: number): Promise<AutomationRun[]>;
  /**
   * Runs already recorded for these event keys — the lookup that keeps a
   * client's decision from being acted on twice. Asking by key instead of
   * reading the whole log keeps this cheap however long the log grows.
   */
  findAutomationRuns(eventKeys: string[]): Promise<AutomationRun[]>;

  // ── Banco de ideias (ficha 08) ────────────────────────────────
  saveIdea(idea: Idea): Promise<Idea>;
  deleteIdea(id: string): Promise<void>;

  // ── Pauta única e planejamento mensal (ficha 17) ──────────────
  savePlan(plan: MonthlyPlan): Promise<MonthlyPlan>;
  deletePlan(id: string): Promise<void>;
  /** Saves one item or a whole weekly series in one go. */
  savePautaItems(items: PautaItem[]): Promise<PautaItem[]>;
  deletePautaItems(ids: string[]): Promise<void>;

  // ── CRM e orquestrador (specs 09 e 10) ────────────────────────
  saveDeal(deal: Deal): Promise<Deal>;
  deleteDeal(id: string): Promise<void>;
  /** Insert-only: correcting an interaction means writing another one. */
  addInteraction(interaction: Interaction): Promise<Interaction>;
  saveCrmTask(task: CrmTask): Promise<CrmTask>;
  deleteCrmTask(id: string): Promise<void>;
  saveBlock(block: ContactBlock): Promise<ContactBlock>;
  deleteBlock(id: string): Promise<void>;
  /** The sale-to-operation saga's persisted state. */
  saveProcess(process: ContractingProcess): Promise<ContractingProcess>;

  // ── Financeiro (spec 08) ──────────────────────────────────────
  saveAccount(account: FinanceAccount): Promise<FinanceAccount>;
  /** Refused when the account has ever moved: deactivate it instead. */
  deleteAccount(id: string): Promise<void>;
  saveCategory(category: FinanceCategory): Promise<FinanceCategory>;
  deleteCategory(id: string): Promise<void>;

  saveEntry(entry: FinanceEntry): Promise<FinanceEntry>;
  deleteEntry(id: string): Promise<void>;
  /** Settle: the money moved, on this date, into this account. */
  settleEntry(id: string, accountId: string, date: string): Promise<FinanceEntry>;
  /** Undo a settlement. The amount never changes; the balance goes back. */
  unsettleEntry(id: string): Promise<FinanceEntry>;
  /** Reverse a settled entry with a mirror entry. The original stays. */
  reverseEntry(id: string): Promise<FinanceEntry>;

  saveSeries(series: FinanceSeries): Promise<FinanceSeries>;
  /** Close a recurring series: projections after the date stop existing. */
  deleteSeries(id: string): Promise<void>;
  /** Turn projections inside the window into real rows. */
  materialiseSeries(): Promise<number>;

  saveTransfer(transfer: Transfer): Promise<Transfer>;
  deleteTransfer(id: string): Promise<void>;

  // ── Catálogo, propostas e contratos (specs 06 e 07) ───────────
  createService(input: Omit<Service, "id" | "createdAt">): Promise<Service>;
  updateService(id: string, patch: Partial<Service>): Promise<Service>;
  deleteService(id: string): Promise<void>;

  /** Create or replace a proposal. An accepted one is refused. */
  saveProposal(proposal: Proposal): Promise<Proposal>;
  /** Assign the next number (if it has none) and put it in front of the client. */
  sendProposal(id: string): Promise<Proposal>;
  /** Only a draft or an archived proposal can be removed. */
  deleteProposal(id: string): Promise<void>;

  saveContract(contract: Contract): Promise<Contract>;
  deleteContract(id: string): Promise<void>;

  // ── Public proposal and contract pages (no session) ───────────
  /** Reading it counts as the client opening it (spec 06: `visualizacao`). */
  getPublicProposal(linkId: string): Promise<Proposal | null>;
  decideProposal(
    linkId: string,
    input: {
      result: Extract<ProposalStatus, "aceita" | "recusada" | "ajuste_pedido">;
      deciderName: string;
      deciderDocument?: string;
      reason?: string;
    },
  ): Promise<void>;
  /** One party's view of a contract, resolved by that party's own token. */
  getPublicContract(
    partyToken: string,
  ): Promise<{ contract: Contract; partyId: string } | null>;
  signContract(
    partyToken: string,
    input: { typedName: string; typedDocument: string },
  ): Promise<void>;

  // ── Agenda (spec 04) ──────────────────────────────────────────
  createAppointment(input: Omit<Appointment, "id" | "createdAt">): Promise<Appointment>;
  updateAppointment(
    id: string,
    patch: Partial<
      Pick<
        Appointment,
        "title" | "description" | "clientId" | "start" | "end" | "location" | "status" | "done"
      >
    >,
  ): Promise<Appointment>;
  /** Keep a catalogue date on the calendar, or drop it. */
  addMarkedDate(date: MarkedDate): Promise<void>;
  removeMarkedDate(id: string): Promise<void>;
  /** Availability and the public page are saved together: they are one choice. */
  saveBookingConfig(input: {
    availability: Availability;
    page: Pick<BookingPage, "active" | "title" | "intro">;
  }): Promise<void>;
  regenerateBookingLink(): Promise<BookingPage>;

  // ── Public booking (no session) ───────────────────────────────
  /**
   * A paused page answers exactly like one that never existed: the visitor
   * cannot even learn that the link was once valid.
   */
  getPublicBookingPage(
    linkId: string,
  ): Promise<{ page: BookingPage; availability: Availability } | null>;
  /** Busy blocks with no detail at all — start and end, nothing else. */
  getPublicBusy(
    linkId: string,
    from: string,
    to: string,
  ): Promise<{ start: string; end: string }[] | null>;
  createPublicBooking(
    linkId: string,
    input: { name: string; email: string; start: string; note?: string },
  ): Promise<{ manageToken: string; start: string; end: string }>;
  cancelPublicBooking(manageToken: string): Promise<void>;

  // ── Public (client) share view ────────────────────────────────
  getPublicView(token: string): Promise<PublicCalendarView | null>;
}
