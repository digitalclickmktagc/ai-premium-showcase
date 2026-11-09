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
import { shareToken } from "../utils";
import { validateDecision } from "../approval";
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
      };
    const [clients, calendars, posts, stages, rules] = await Promise.all([
      this.rest<any[]>("clients?select=*"),
      this.rest<any[]>("calendars?select=*"),
      this.rest<any[]>("posts?select=*"),
      this.rest<any[]>("board_stage?select=*&order=position.asc"),
      // Rules are small and bounded, so they travel with the first load. The
      // execution log does not: it only grows, and is fetched on demand.
      this.rest<any[]>("automation_rule?select=*&order=created_at.asc"),
    ]);
    return {
      clients: clients.map(toClient),
      calendars: calendars.map(toCalendar),
      posts: posts.map(toPost),
      boardStages: stages.map(toStage),
      automationRules: rules.map(toRule),
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
