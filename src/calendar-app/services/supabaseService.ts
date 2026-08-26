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
  active: r.active,
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
  createdAt: r.created_at,
  updatedAt: r.updated_at,
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
    if (!this.session) return { clients: [], calendars: [], posts: [] };
    const [clients, calendars, posts] = await Promise.all([
      this.rest<any[]>("clients?select=*"),
      this.rest<any[]>("calendars?select=*"),
      this.rest<any[]>("posts?select=*"),
    ]);
    return {
      clients: clients.map(toClient),
      calendars: calendars.map(toCalendar),
      posts: posts.map(toPost),
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
        active: input.active ?? true,
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
    if (patch.active !== undefined) row.active = patch.active;
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

  // ── Public share view (anon RPC, isolated + sanitized) ────────
  async getPublicView(token: string): Promise<PublicCalendarView | null> {
    const data = await this.rest<PublicCalendarView | null>("rpc/get_public_calendar", {
      method: "POST",
      useUser: false, // anonymous client
      body: JSON.stringify({ p_token: token }),
    });
    return data ?? null;
  }
}
