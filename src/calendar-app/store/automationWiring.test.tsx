import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import type { Database, Post, PostStatus } from "../types";
import type { DataService } from "../services/DataService";
import type { AutomationRule, AutomationRun } from "../automation";

let service: DataService;
vi.mock("../services", () => ({
  getDataService: () => service,
  isSupabaseConfigured: false,
}));

const { AppProvider, useApp } = await import("./AppProvider");

const POST: Post = {
  id: "p1",
  calendarId: "cal1",
  title: "Post",
  date: "2026-06-10",
  status: "todo",
  description: "",
  rescheduleHistory: [],
  createdAt: "t",
  updatedAt: "t",
};

const rule = (over: Partial<AutomationRule> = {}): AutomationRule => ({
  id: "r1",
  calendarId: "cal1",
  trigger: { type: "entered_stage", stage: "done" },
  action: { type: "send_for_review" },
  active: true,
  createdAt: "2026-06-01T00:00:00.000Z",
  ...over,
});

/**
 * A fake backend that actually applies writes, so the provider's follow-up
 * refresh sees them — the only way to tell a real chain from a no-op.
 */
function fakeBackend(db: Database) {
  const runs: AutomationRun[] = [];
  const calls = { requestApproval: 0, updates: [] as { id: string; patch: unknown }[] };
  const notUsed = () => Promise.reject(new Error("not used in this test"));
  const session = { role: "admin" as const, email: "a@b.c", name: "A" };

  const svc: DataService = {
    name: "fake",
    getSession: () => session,
    initSession: async () => session,
    login: async () => session,
    logout: () => undefined,
    getDatabase: async () => structuredClone(db),
    createClient: notUsed as unknown as DataService["createClient"],
    updateClient: notUsed as unknown as DataService["updateClient"],
    regenerateShareToken: notUsed as unknown as DataService["regenerateShareToken"],
    createPost: notUsed as unknown as DataService["createPost"],
    updatePost: vi.fn(async (id: string, patch) => {
      calls.updates.push({ id, patch });
      const i = db.posts.findIndex((p) => p.id === id);
      db.posts[i] = { ...db.posts[i], ...(patch as Partial<Post>) };
      return db.posts[i];
    }) as unknown as DataService["updatePost"],
    requestApproval: vi.fn(async (id: string) => {
      calls.requestApproval += 1;
      const i = db.posts.findIndex((p) => p.id === id);
      db.posts[i] = {
        ...db.posts[i],
        approval: { round: 1, decisions: db.posts[i].approval?.decisions ?? [] },
      };
      return db.posts[i];
    }) as unknown as DataService["requestApproval"],
    issueApprovalCode: notUsed as unknown as DataService["issueApprovalCode"],
    submitApprovalDecision:
      notUsed as unknown as DataService["submitApprovalDecision"],
    reschedulePost: notUsed as unknown as DataService["reschedulePost"],
    deletePost: notUsed as unknown as DataService["deletePost"],
    restorePost: notUsed as unknown as DataService["restorePost"],
    getPublicView: async () => null,
    createAutomationRule: notUsed as unknown as DataService["createAutomationRule"],
    updateAutomationRule: notUsed as unknown as DataService["updateAutomationRule"],
    deleteAutomationRule: notUsed as unknown as DataService["deleteAutomationRule"],
    logAutomationRun: async (run) => {
      runs.push(run);
    },
    listAutomationRuns: async () => [...runs].reverse(),
    findAutomationRuns: async (keys) =>
      runs.filter((r) => r.eventKey && keys.includes(r.eventKey)),
  };
  return { svc, runs, calls };
}

function Probe({ to = "done" as PostStatus }: { to?: PostStatus }) {
  const { posts, changeStatus } = useApp();
  return (
    <div>
      <span data-testid="status">{posts[0]?.status ?? "none"}</span>
      <span data-testid="round">{posts[0]?.approval?.round ?? 0}</span>
      <button onClick={() => void changeStatus("p1", to)}>mudar</button>
    </div>
  );
}

async function renderProbe(to?: PostStatus) {
  render(
    <AppProvider>
      <Probe to={to} />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("status")).toBeInTheDocument());
}

beforeEach(() => {
  localStorage.clear();
});

describe("AppProvider — automations on a stage change", () => {
  it("runs the matching rule and records it in the log", async () => {
    const db: Database = {
      clients: [],
      calendars: [],
      posts: [{ ...POST }],
      automationRules: [rule()],
    };
    const { svc, runs, calls } = fakeBackend(db);
    service = svc;

    await renderProbe();
    await act(async () => {
      screen.getByText("mudar").click();
    });

    await waitFor(() => expect(calls.requestApproval).toBe(1));
    expect(screen.getByTestId("status")).toHaveTextContent("done");
    expect(screen.getByTestId("round")).toHaveTextContent("1");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ ruleId: "r1", postId: "p1", result: "applied" });
  });

  it("leaves the stage change alone when no rule matches", async () => {
    const db: Database = {
      clients: [],
      calendars: [],
      posts: [{ ...POST }],
      automationRules: [rule({ trigger: { type: "entered_stage", stage: "published" } })],
    };
    const { svc, runs, calls } = fakeBackend(db);
    service = svc;

    await renderProbe();
    await act(async () => {
      screen.getByText("mudar").click();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("done");
    expect(calls.requestApproval).toBe(0);
    expect(runs).toEqual([]);
  });

  it("still moves the card when the automation itself fails", async () => {
    const db: Database = {
      clients: [],
      calendars: [],
      posts: [{ ...POST }],
      automationRules: [rule()],
    };
    const { svc, runs } = fakeBackend(db);
    svc.requestApproval = vi.fn(async () => {
      throw new Error("Cliente sem e-mail cadastrado.");
    }) as unknown as DataService["requestApproval"];
    service = svc;

    await renderProbe();
    await act(async () => {
      screen.getByText("mudar").click();
    });

    await waitFor(() => expect(runs).toHaveLength(1));
    expect(screen.getByTestId("status")).toHaveTextContent("done");
    expect(runs[0]).toMatchObject({
      result: "failed",
      detail: "Cliente sem e-mail cadastrado.",
    });
  });
});

describe("AppProvider — catching up on a client's decision", () => {
  const approvedPost = (): Post => ({
    ...POST,
    status: "done",
    approval: {
      round: 1,
      decisions: [
        {
          id: "d1",
          round: 1,
          result: "approved",
          verified: true,
          at: "2026-06-11T10:00:00.000Z",
        },
      ],
    },
  });

  const publishOnApproval = rule({
    id: "pub",
    trigger: { type: "review_decided", result: "approved" },
    action: { type: "move_to_stage", stage: "published" },
  });

  it("applies the rule on load, and only once", async () => {
    const db: Database = {
      clients: [],
      calendars: [],
      posts: [approvedPost()],
      automationRules: [publishOnApproval],
    };
    const { svc, runs } = fakeBackend(db);
    service = svc;

    await renderProbe();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("published"));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ ruleId: "pub", eventKey: "decision:d1" });

    // The refresh that follows re-renders with new posts; nothing may fire again.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(runs).toHaveLength(1);
  });

  it("does nothing when the log already shows the decision was handled", async () => {
    const db: Database = {
      clients: [],
      calendars: [],
      posts: [approvedPost()],
      automationRules: [publishOnApproval],
    };
    const { svc, runs, calls } = fakeBackend(db);
    runs.push({
      id: "old",
      ruleId: "pub",
      postId: "p1",
      at: "2026-06-11T10:00:05.000Z",
      result: "applied",
      eventKey: "decision:d1",
    });
    service = svc;

    await renderProbe();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.getByTestId("status")).toHaveTextContent("done");
    expect(calls.updates).toEqual([]);
    expect(runs).toHaveLength(1);
  });
});
