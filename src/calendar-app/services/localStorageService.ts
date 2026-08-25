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
import { randomClientColor, shareToken, uid } from "../utils";
import { buildSeed } from "./seed";
import type { DataService } from "./DataService";

const DB_KEY = "editorial-calendar:db:v1";
const SESSION_KEY = "editorial-calendar:session:v1";

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
      active: input.active ?? true,
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
    if (patch.active !== undefined) client.active = patch.active;
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

  // ── Public share view (isolated + sanitized) ──────────────────
  async getPublicView(token: string): Promise<PublicCalendarView | null> {
    const db = this.read();
    const calendar = db.calendars.find((c) => c.shareToken === token);
    if (!calendar) return null;
    const client = db.clients.find((c) => c.id === calendar.clientId);
    if (!client) return null;

    const posts = db.posts
      .filter((p) => p.calendarId === calendar.id && p.status !== "deleted")
      // Strip internal notes — never expose them to clients.
      .map(({ internalNotes: _internal, ...rest }) => rest);

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
      },
      posts,
    };
  }
}
