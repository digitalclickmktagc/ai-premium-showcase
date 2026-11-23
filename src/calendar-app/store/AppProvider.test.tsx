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
    createAutomationRule: notUsed as unknown as DataService["createAutomationRule"],
    updateAutomationRule: notUsed as unknown as DataService["updateAutomationRule"],
    deleteAutomationRule: notUsed as unknown as DataService["deleteAutomationRule"],
    saveDeal: notUsed as unknown as DataService["saveDeal"],
    deleteDeal: async () => undefined,
    addInteraction: notUsed as unknown as DataService["addInteraction"],
    saveAssessmentTemplate: notUsed as unknown as DataService["saveAssessmentTemplate"],
    saveAssessment: notUsed as unknown as DataService["saveAssessment"],
    deleteAssessment: notUsed as unknown as DataService["deleteAssessment"],
    saveWebhook: notUsed as unknown as DataService["saveWebhook"],
    deleteWebhook: notUsed as unknown as DataService["deleteWebhook"],
    enqueueWebhookTest: notUsed as unknown as DataService["enqueueWebhookTest"],
    saveScript: notUsed as unknown as DataService["saveScript"],
    deleteScript: notUsed as unknown as DataService["deleteScript"],
    saveForm: notUsed as unknown as DataService["saveForm"],
    deleteForm: notUsed as unknown as DataService["deleteForm"],
    getPublicForm: notUsed as unknown as DataService["getPublicForm"],
    submitForm: notUsed as unknown as DataService["submitForm"],
    saveStatementLines: notUsed as unknown as DataService["saveStatementLines"],
    deleteStatementLine: notUsed as unknown as DataService["deleteStatementLine"],
    saveProject: notUsed as unknown as DataService["saveProject"],
    deleteProject: notUsed as unknown as DataService["deleteProject"],
    saveSquad: notUsed as unknown as DataService["saveSquad"],
    deleteSquad: notUsed as unknown as DataService["deleteSquad"],
    saveHealthWeights: notUsed as unknown as DataService["saveHealthWeights"],
    saveAiSettings: notUsed as unknown as DataService["saveAiSettings"],
    saveDossierTemplate: notUsed as unknown as DataService["saveDossierTemplate"],
    saveDossier: notUsed as unknown as DataService["saveDossier"],
    getPublicDossier: notUsed as unknown as DataService["getPublicDossier"],
    savePlan: notUsed as unknown as DataService["savePlan"],
    deletePlan: notUsed as unknown as DataService["deletePlan"],
    savePautaItems: notUsed as unknown as DataService["savePautaItems"],
    deletePautaItems: notUsed as unknown as DataService["deletePautaItems"],
    saveIdea: notUsed as unknown as DataService["saveIdea"],
    deleteIdea: notUsed as unknown as DataService["deleteIdea"],
    saveCrmTask: notUsed as unknown as DataService["saveCrmTask"],
    deleteCrmTask: async () => undefined,
    saveBlock: notUsed as unknown as DataService["saveBlock"],
    deleteBlock: async () => undefined,
    saveProcess: notUsed as unknown as DataService["saveProcess"],
    saveAccount: notUsed as unknown as DataService["saveAccount"],
    deleteAccount: async () => undefined,
    saveCategory: notUsed as unknown as DataService["saveCategory"],
    deleteCategory: async () => undefined,
    saveEntry: notUsed as unknown as DataService["saveEntry"],
    deleteEntry: async () => undefined,
    settleEntry: notUsed as unknown as DataService["settleEntry"],
    unsettleEntry: notUsed as unknown as DataService["unsettleEntry"],
    reverseEntry: notUsed as unknown as DataService["reverseEntry"],
    saveSeries: notUsed as unknown as DataService["saveSeries"],
    deleteSeries: async () => undefined,
    materialiseSeries: async () => 0,
    saveTransfer: notUsed as unknown as DataService["saveTransfer"],
    deleteTransfer: async () => undefined,
    createService: notUsed as unknown as DataService["createService"],
    updateService: notUsed as unknown as DataService["updateService"],
    deleteService: async () => undefined,
    saveProposal: notUsed as unknown as DataService["saveProposal"],
    sendProposal: notUsed as unknown as DataService["sendProposal"],
    deleteProposal: async () => undefined,
    saveContract: notUsed as unknown as DataService["saveContract"],
    deleteContract: async () => undefined,
    getPublicProposal: async () => null,
    decideProposal: async () => undefined,
    getPublicContract: async () => null,
    signContract: async () => undefined,
    createAppointment: notUsed as unknown as DataService["createAppointment"],
    updateAppointment: notUsed as unknown as DataService["updateAppointment"],
    addMarkedDate: async () => undefined,
    removeMarkedDate: async () => undefined,
    saveBookingConfig: async () => undefined,
    regenerateBookingLink: notUsed as unknown as DataService["regenerateBookingLink"],
    getPublicBookingPage: async () => null,
    getPublicBusy: async () => null,
    createPublicBooking: notUsed as unknown as DataService["createPublicBooking"],
    cancelPublicBooking: async () => undefined,
    createBoardStage: notUsed as unknown as DataService["createBoardStage"],
    updateBoardStage: notUsed as unknown as DataService["updateBoardStage"],
    deleteBoardStage: notUsed as unknown as DataService["deleteBoardStage"],
    reorderBoardStages: async () => undefined,
    logAutomationRun: async () => undefined,
    listAutomationRuns: async () => [],
    findAutomationRuns: async () => [],
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
