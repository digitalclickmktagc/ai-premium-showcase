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

    expect(calls).toHaveLength(3);
    for (const c of calls) {
      expect(c.headers.apikey).toBe(KEY);
      expect(c.headers.Authorization).toBe("Bearer user-access-token");
    }
    expect(calls.map((c) => c.url)).toEqual([
      `${URL}/rest/v1/clients?select=*`,
      `${URL}/rest/v1/calendars?select=*`,
      `${URL}/rest/v1/posts?select=*`,
    ]);
  });

  it("returns empty data when signed out (never calls the API)", async () => {
    const svc = new SupabaseService(URL, KEY);
    mockFetch([{ body: [] }]);
    const db = await svc.getDatabase();
    expect(db).toEqual({ clients: [], calendars: [], posts: [] });
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
