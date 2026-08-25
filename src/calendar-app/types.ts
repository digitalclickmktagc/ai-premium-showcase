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

export interface Client {
  id: string;
  name: string;
  /** Hex accent color used for the client's visual identity. */
  color: string;
  /** Optional logo image URL. */
  logoUrl?: string;
  /** Optional short handle / social @ shown in the client view. */
  handle?: string;
  active: boolean;
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
  createdAt: string;
  updatedAt: string;
}

/** Auth session. Clients access via token only, so sessions are admin-only. */
export interface Session {
  role: "admin";
  email: string;
  name: string;
}

/** Full persisted database shape (used by the localStorage adapter). */
export interface Database {
  clients: Client[];
  calendars: Calendar[];
  posts: Post[];
}

/**
 * Sanitized calendar payload for the public (client) share view.
 * Deleted posts are excluded and `internalNotes` is stripped from every post,
 * enforcing the isolation requirements from spec section 6.
 */
export type PublicPost = Omit<Post, "internalNotes">;

export interface PublicCalendarView {
  calendar: Pick<Calendar, "id" | "name" | "shareToken">;
  client: Pick<Client, "id" | "name" | "color" | "logoUrl" | "handle">;
  posts: PublicPost[];
}

/** Input payloads. */
export interface CreateClientInput {
  name: string;
  color?: string;
  logoUrl?: string;
  handle?: string;
  active?: boolean;
  /** Optional override for the auto-created calendar name. */
  calendarName?: string;
}

export type UpdateClientInput = Partial<
  Pick<Client, "name" | "color" | "logoUrl" | "handle" | "active">
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
  >
>;
