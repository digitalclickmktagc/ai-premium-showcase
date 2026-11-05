import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import type { Database, Post } from "../types";
import type { DataService } from "../services/DataService";

// The provider resolves its adapter through getDataService(); swap in a fake.
let service: DataService;
vi.mock("../services", () => ({
  getDataService: () => service,
  isSupabaseConfigured: false,
}));

// Imported after the mock is registered.
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

function makeService(updatePost: DataService["updatePost"], db: Database): DataService {
  const session = { role: "admin" as const, email: "a@b.c", name: "A" };
  const notUsed = () => Promise.reject(new Error("not used in this test"));
  return {
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
    updatePost,
    requestApproval: notUsed as unknown as DataService["requestApproval"],
    issueApprovalCode: notUsed as unknown as DataService["issueApprovalCode"],
    submitApprovalDecision:
      notUsed as unknown as DataService["submitApprovalDecision"],
    reschedulePost: notUsed as unknown as DataService["reschedulePost"],
    deletePost: notUsed as unknown as DataService["deletePost"],
    restorePost: notUsed as unknown as DataService["restorePost"],
    getPublicView: async () => null,
  };
}

let moveResult: Promise<void>;

function Probe() {
  const { posts, movePost } = useApp();
  return (
    <div>
      <span data-testid="date">{posts[0]?.date ?? "none"}</span>
      <span data-testid="hist">{posts[0]?.rescheduleHistory.length ?? -1}</span>
      <button
        onClick={() => {
          moveResult = movePost("p1", "2026-06-20");
        }}
      >
        mover
      </button>
    </div>
  );
}

async function renderProbe() {
  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("date")).toBeInTheDocument());
}

beforeEach(() => {
  localStorage.clear();
});

describe("AppProvider — movePost (drag & drop)", () => {
  it("persists the new day and records the reschedule", async () => {
    const db: Database = { clients: [], calendars: [], posts: [{ ...POST }] };
    const updatePost = vi.fn(async (_id: string, patch: { date?: string }) => {
      // the fake backend applies the change, so the follow-up refresh keeps it
      db.posts[0] = { ...db.posts[0], date: patch.date! };
      return db.posts[0];
    });
    service = makeService(updatePost as unknown as DataService["updatePost"], db);

    await renderProbe();
    expect(screen.getByTestId("date")).toHaveTextContent("2026-06-10");

    await act(async () => {
      screen.getByText("mover").click();
      await moveResult;
    });

    expect(updatePost).toHaveBeenCalledWith("p1", { date: "2026-06-20" });
    expect(screen.getByTestId("date")).toHaveTextContent("2026-06-20");
  });

  it("moves the card immediately, before the backend answers", async () => {
    const db: Database = { clients: [], calendars: [], posts: [{ ...POST }] };
    let release!: () => void;
    const pending = new Promise<void>((r) => (release = r));
    const updatePost = vi.fn(async (_id: string, patch: { date?: string }) => {
      await pending; // hold the write open
      db.posts[0] = { ...db.posts[0], date: patch.date! };
      return db.posts[0];
    });
    service = makeService(updatePost as unknown as DataService["updatePost"], db);

    await renderProbe();
    await act(async () => {
      screen.getByText("mover").click();
    });

    // optimistic: already moved, and the history entry is there
    expect(screen.getByTestId("date")).toHaveTextContent("2026-06-20");
    expect(screen.getByTestId("hist")).toHaveTextContent("1");

    await act(async () => {
      release();
      await moveResult;
    });
    expect(screen.getByTestId("date")).toHaveTextContent("2026-06-20");
  });

  it("puts the card back when the write fails", async () => {
    const db: Database = { clients: [], calendars: [], posts: [{ ...POST }] };
    const updatePost = vi.fn(async () => {
      throw new Error("rede indisponível");
    });
    service = makeService(updatePost as unknown as DataService["updatePost"], db);

    await renderProbe();
    expect(screen.getByTestId("date")).toHaveTextContent("2026-06-10");

    await act(async () => {
      screen.getByText("mover").click();
      await moveResult.catch(() => undefined); // the caller surfaces the error
    });

    // reverted to the original day, with no stray history entry
    expect(screen.getByTestId("date")).toHaveTextContent("2026-06-10");
    expect(screen.getByTestId("hist")).toHaveTextContent("0");
  });
});
