import type {
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

  // ── Public (client) share view ────────────────────────────────
  getPublicView(token: string): Promise<PublicCalendarView | null>;
}
