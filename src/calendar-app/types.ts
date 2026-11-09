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
  createdAt: string;
  updatedAt: string;
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

/** Full persisted database shape (used by the localStorage adapter). */
export interface Database {
  clients: Client[];
  calendars: Calendar[];
  posts: Post[];
  /** Short-lived approval codes. Never exposed through the public view. */
  approvalCodes?: ApprovalCodeEntry[];
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
  "internalNotes" | "checklist" | "comments" | "attachments" | "timeEntries"
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
  >
>;
