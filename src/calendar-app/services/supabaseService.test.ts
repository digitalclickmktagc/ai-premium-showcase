import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { SupabaseService } from "./supabaseService";

const URL = "https://example.supabase.co";
const KEY = "sb_publishable_TESTKEY";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

let calls: Call[] = [];

/** Install a fetch mock that records calls and replies with `responses` in order. */
function mockFetch(responses: Array<{ status?: number; body: unknown }>) {
  let i = 0;
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? "GET",
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    const r = responses[Math.min(i++, responses.length - 1)];
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const TOKEN_RESPONSE = {
  access_token: "user-access-token",
  refresh_token: "user-refresh-token",
  expires_in: 3600,
  user: { email: "admin@agencia.com", user_metadata: { name: "Admin" } },
};

async function loggedInService() {
  const svc = new SupabaseService(URL, KEY);
  mockFetch([{ body: TOKEN_RESPONSE }]);
  await svc.login("admin@agencia.com", "senha");
  calls = [];
  return svc;
}

beforeEach(() => {
  calls = [];
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SupabaseService — URL normalization", () => {
  it("accepts a URL pasted with a trailing /rest/v1/ and a trailing slash", async () => {
    const svc = new SupabaseService(`${URL}/rest/v1/`, KEY);
    mockFetch([{ body: TOKEN_RESPONSE }]);
    await svc.login("a@b.com", "x");
    expect(calls[0].url).toBe(`${URL}/auth/v1/token?grant_type=password`);
  });
});

describe("SupabaseService — auth", () => {
  it("logs in against the GoTrue endpoint with the apikey header", async () => {
    const svc = new SupabaseService(URL, KEY);
    mockFetch([{ body: TOKEN_RESPONSE }]);
    const session = await svc.login("admin@agencia.com", "senha");

    expect(calls[0].url).toBe(`${URL}/auth/v1/token?grant_type=password`);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers.apikey).toBe(KEY);
    expect(calls[0].body).toEqual({ email: "admin@agencia.com", password: "senha" });
    expect(session).toEqual({ role: "admin", email: "admin@agencia.com", name: "Admin" });
    // session persists for reloads
    expect(svc.getSession()?.email).toBe("admin@agencia.com");
  });

  it("surfaces a friendly message on bad credentials", async () => {
    const svc = new SupabaseService(URL, KEY);
    mockFetch([{ status: 400, body: { error_description: "Invalid login credentials" } }]);
    await expect(svc.login("a@b.com", "wrong")).rejects.toThrow("Invalid login credentials");
  });

  it("restores a stored session and clears it on logout", async () => {
    const svc = await loggedInService();
    const restored = new SupabaseService(URL, KEY);
    expect(restored.getSession()?.email).toBe("admin@agencia.com");

    mockFetch([{ body: {} }]);
    svc.logout();
    expect(svc.getSession()).toBeNull();
    expect(new SupabaseService(URL, KEY).getSession()).toBeNull();
  });
});

describe("SupabaseService — authenticated reads", () => {
  it("sends the user token (not just the anon key) when loading data", async () => {
    const svc = await loggedInService();
    mockFetch([{ body: [] }]);
    await svc.getDatabase();

    expect(calls).toHaveLength(4);
    for (const c of calls) {
      expect(c.headers.apikey).toBe(KEY);
      expect(c.headers.Authorization).toBe("Bearer user-access-token");
    }
    expect(calls.map((c) => c.url)).toEqual([
      `${URL}/rest/v1/clients?select=*`,
      `${URL}/rest/v1/calendars?select=*`,
      `${URL}/rest/v1/posts?select=*`,
      `${URL}/rest/v1/automation_rule?select=*&order=created_at.asc`,
    ]);
  });

  it("returns empty data when signed out (never calls the API)", async () => {
    const svc = new SupabaseService(URL, KEY);
    mockFetch([{ body: [] }]);
    const db = await svc.getDatabase();
    expect(db).toEqual({ clients: [], calendars: [], posts: [], automationRules: [] });
    expect(calls).toHaveLength(0);
  });
});

describe("SupabaseService — client creation", () => {
  it("creates the client then its calendar with a share token", async () => {
    const svc = await loggedInService();
    mockFetch([
      { body: [{ id: "c1", name: "Aurora", color: "#f97316", active: true, created_at: "t" }] },
      {
        body: [
          { id: "cal1", client_id: "c1", name: "Calendário Aurora", share_token: "tok", created_at: "t" },
        ],
      },
    ]);

    const { client, calendar } = await svc.createClient({ name: "Aurora" });

    expect(calls[0].url).toBe(`${URL}/rest/v1/clients`);
    expect(calls[0].headers.Prefer).toBe("return=representation");
    expect(calls[1].url).toBe(`${URL}/rest/v1/calendars`);
    // calendar links to the created client and gets a generated token
    expect((calls[1].body as { client_id: string }).client_id).toBe("c1");
    expect((calls[1].body as { share_token: string }).share_token).toBeTruthy();
    expect(client.name).toBe("Aurora");
    expect(calendar.shareToken).toBe("tok");
  });
});

describe("SupabaseService — post updates", () => {
  const basePost = {
    id: "p1",
    calendar_id: "cal1",
    title: "P",
    date: "2026-06-10",
    status: "todo",
    description: "",
    reschedule_history: [],
    created_at: "t",
    updated_at: "t",
  };

  it("appends reschedule history when the date changes", async () => {
    const svc = await loggedInService();
    mockFetch([
      { body: [basePost] }, // fetchPost
      { body: [{ ...basePost, date: "2026-06-20" }] }, // patch
    ]);

    await svc.updatePost("p1", { date: "2026-06-20" });

    const patch = calls[1].body as { reschedule_history: Array<{ from: string; to: string }> };
    expect(calls[1].method).toBe("PATCH");
    expect(calls[1].url).toBe(`${URL}/rest/v1/posts?id=eq.p1`);
    expect(patch.reschedule_history).toHaveLength(1);
    expect(patch.reschedule_history[0]).toMatchObject({ from: "2026-06-10", to: "2026-06-20" });
  });

  it("does not touch history when the date is unchanged", async () => {
    const svc = await loggedInService();
    mockFetch([{ body: [basePost] }, { body: [{ ...basePost, title: "P2" }] }]);
    await svc.updatePost("p1", { title: "P2" });
    expect(calls[1].body).not.toHaveProperty("reschedule_history");
  });

  it("soft-deletes by setting status, never issuing a DELETE", async () => {
    const svc = await loggedInService();
    mockFetch([{ body: [{ ...basePost, status: "deleted" }] }]);
    await svc.deletePost("p1");
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].body).toEqual({ status: "deleted" });
  });
});

describe("SupabaseService — public share view (isolation)", () => {
  it("calls the RPC anonymously, without the admin token", async () => {
    const svc = await loggedInService(); // even while an admin is signed in
    mockFetch([{ body: { calendar: { id: "cal1" }, client: { id: "c1" }, posts: [] } }]);

    await svc.getPublicView("tok123");

    expect(calls[0].url).toBe(`${URL}/rest/v1/rpc/get_public_calendar`);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({ p_token: "tok123" });
    // anon key only — the client view must never ride on admin credentials
    expect(calls[0].headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("returns null for an unknown token", async () => {
    const svc = new SupabaseService(URL, KEY);
    mockFetch([{ body: null }]);
    expect(await svc.getPublicView("nope")).toBeNull();
  });
});

describe("SupabaseService — stage automations", () => {
  it("creates a rule with snake_case columns and the jsonb trigger/action", async () => {
    const svc = await loggedInService();
    mockFetch([
      {
        body: [
          {
            id: "r1",
            calendar_id: "cal1",
            trigger: { type: "entered_stage", stage: "done" },
            action: { type: "send_for_review" },
            active: true,
            created_at: "t",
          },
        ],
      },
    ]);

    const rule = await svc.createAutomationRule({
      calendarId: "cal1",
      active: true,
      trigger: { type: "entered_stage", stage: "done" },
      action: { type: "send_for_review" },
    });

    expect(calls[0].url).toBe(`${URL}/rest/v1/automation_rule`);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({
      calendar_id: "cal1",
      trigger: { type: "entered_stage", stage: "done" },
      action: { type: "send_for_review" },
      active: true,
    });
    expect(rule).toMatchObject({ id: "r1", calendarId: "cal1", active: true });
  });

  it("never sends an invalid rule to the server", async () => {
    const svc = await loggedInService();
    mockFetch([{ body: [] }]);
    await expect(
      svc.createAutomationRule({
        calendarId: "cal1",
        active: true,
        trigger: { type: "entered_stage", stage: "done" },
        action: { type: "move_to_stage", stage: "done" },
      }),
    ).rejects.toThrow(/mesma etapa/);
    expect(calls).toHaveLength(0);
  });

  it("looks runs up by event key in one request", async () => {
    const svc = await loggedInService();
    mockFetch([{ body: [] }]);
    await svc.findAutomationRuns(["decision:d1", "decision:d2"]);

    expect(calls).toHaveLength(1);
    expect(decodeURIComponent(calls[0].url)).toBe(
      `${URL}/rest/v1/automation_run?event_key=in.("decision:d1","decision:d2")&select=*`,
    );
  });

  it("asks for nothing when there are no keys to check", async () => {
    const svc = await loggedInService();
    mockFetch([{ body: [] }]);
    expect(await svc.findAutomationRuns([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("scopes the history to the calendar server-side, newest first", async () => {
    const svc = await loggedInService();
    mockFetch([{ body: [] }]);
    await svc.listAutomationRuns("cal1", 10);

    expect(decodeURIComponent(calls[0].url)).toContain("automation_run?select=*,posts!inner(calendar_id)");
    expect(decodeURIComponent(calls[0].url)).toContain("posts.calendar_id=eq.cal1");
    expect(calls[0].url).toContain("order=at.desc");
    expect(calls[0].url).toContain("limit=10");
  });

  it("swallows a refused log insert — the automation already happened", async () => {
    const svc = await loggedInService();
    mockFetch([{ status: 403, body: { message: "no" } }]);
    await expect(
      svc.logAutomationRun({
        id: "run1",
        ruleId: "r1",
        postId: "p1",
        at: "t",
        result: "applied",
      }),
    ).resolves.toBeUndefined();
  });

  it("reads nothing from these tables while signed out", async () => {
    const svc = new SupabaseService(URL, KEY);
    mockFetch([{ body: [] }]);
    expect(await svc.listAutomationRuns("cal1")).toEqual([]);
    expect(await svc.findAutomationRuns(["decision:d1"])).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe("SupabaseService — delivering the verification code", () => {
  it("asks the Edge Function first and reports the code as delivered", async () => {
    const svc = new SupabaseService(URL, KEY);
    mockFetch([{ body: { masked_email: "a***@cliente.com", delivered: true } }]);

    const res = await svc.issueApprovalCode("tok", "p1");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${URL}/functions/v1/send-approval-code`);
    expect(calls[0].body).toEqual({ token: "tok", postId: "p1" });
    expect(res).toEqual({ maskedEmail: "a***@cliente.com", delivered: true });
  });

  it("sends only the publishable key — never a user session — to the function", async () => {
    const svc = await loggedInService();
    mockFetch([{ body: { masked_email: "a***@cliente.com" } }]);
    await svc.issueApprovalCode("tok", "p1");

    expect(calls[0].headers.apikey).toBe(KEY);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("falls back to the RPC when the function is not deployed, and says so", async () => {
    const svc = new SupabaseService(URL, KEY);
    mockFetch([
      { status: 404, body: { message: "not found" } },
      { body: { masked_email: "a***@cliente.com" } },
    ]);

    const res = await svc.issueApprovalCode("tok", "p1");

    expect(calls.map((c) => c.url)).toEqual([
      `${URL}/functions/v1/send-approval-code`,
      `${URL}/rest/v1/rpc/issue_approval_code`,
    ]);
    expect(res).toEqual({ maskedEmail: "a***@cliente.com", delivered: false });
  });

  it("falls back the same way when the function has no e-mail provider (501)", async () => {
    const svc = new SupabaseService(URL, KEY);
    mockFetch([
      { status: 501, body: { error: "Envio de e-mail ainda não configurado." } },
      { body: { masked_email: "a***@cliente.com" } },
    ]);

    const res = await svc.issueApprovalCode("tok", "p1");
    expect(res.delivered).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it("surfaces a real refusal instead of silently issuing a code", async () => {
    const svc = new SupabaseService(URL, KEY);
    // The database's own message: the share link does not match this post.
    mockFetch([{ status: 400, body: { message: "Post não encontrado neste calendário." } }]);

    await expect(svc.issueApprovalCode("tok", "p1")).rejects.toThrow(
      /Post não encontrado neste calendário/,
    );
    expect(calls).toHaveLength(1); // no fallback: the refusal is the answer
  });

  it("surfaces the cooldown rather than retrying through the RPC", async () => {
    const svc = new SupabaseService(URL, KEY);
    mockFetch([{ status: 400, body: { message: "Aguarde 42 segundos para pedir um novo código." } }]);

    await expect(svc.issueApprovalCode("tok", "p1")).rejects.toThrow(/Aguarde 42 segundos/);
    expect(calls).toHaveLength(1);
  });
});
