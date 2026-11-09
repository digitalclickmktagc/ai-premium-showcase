import type { AutomationRule, AutomationRun } from "../automation";
import type {
  ApprovalResult,
  BoardStage,
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

  // ── Public (client) share view ────────────────────────────────
  getPublicView(token: string): Promise<PublicCalendarView | null>;
}
