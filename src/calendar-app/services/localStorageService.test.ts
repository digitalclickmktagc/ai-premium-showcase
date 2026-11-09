import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageService } from "./localStorageService";

function freshService() {
  localStorage.clear();
  return new LocalStorageService();
}

describe("LocalStorageService — seeding", () => {
  beforeEach(() => localStorage.clear());

  it("seeds demo data on first read", async () => {
    const svc = new LocalStorageService();
    const db = await svc.getDatabase();
    expect(db.clients.length).toBeGreaterThan(0);
    expect(db.calendars.length).toBe(db.clients.length);
    expect(db.posts.length).toBeGreaterThan(0);
  });
});

describe("LocalStorageService — clients & calendars", () => {
  let svc: LocalStorageService;
  beforeEach(() => {
    svc = freshService();
  });

  it("creates a client with an auto calendar and unique token", async () => {
    const a = await svc.createClient({ name: "Cliente A" });
    const b = await svc.createClient({ name: "Cliente B" });
    expect(a.calendar.clientId).toBe(a.client.id);
    expect(a.calendar.name).toBe("Calendário Cliente A");
    expect(a.calendar.shareToken).toBeTruthy();
    expect(a.calendar.shareToken).not.toBe(b.calendar.shareToken);
  });

  it("regenerating the share token invalidates the old link", async () => {
    const { calendar } = await svc.createClient({ name: "Cliente A" });
    const oldToken = calendar.shareToken;
    const updated = await svc.regenerateShareToken(calendar.id);
    expect(updated.shareToken).not.toBe(oldToken);
    expect(await svc.getPublicView(oldToken)).toBeNull();
    expect(await svc.getPublicView(updated.shareToken)).not.toBeNull();
  });
});

describe("LocalStorageService — public view isolation (spec §6)", () => {
  let svc: LocalStorageService;
  beforeEach(() => {
    svc = freshService();
  });

  it("exposes only the requested calendar, strips internal notes, hides deleted", async () => {
    const a = await svc.createClient({ name: "Cliente A" });
    const b = await svc.createClient({ name: "Cliente B" });

    await svc.createPost({
      calendarId: a.calendar.id,
      title: "Post A1",
      date: "2026-06-10",
      internalNotes: "segredo interno",
    });
    const deleted = await svc.createPost({
      calendarId: a.calendar.id,
      title: "Post A2",
      date: "2026-06-11",
    });
    await svc.deletePost(deleted.id);
    await svc.createPost({
      calendarId: b.calendar.id,
      title: "Post B1",
      date: "2026-06-12",
    });

    const view = await svc.getPublicView(a.calendar.shareToken);
    expect(view).not.toBeNull();
    // Only calendar A's non-deleted posts
    expect(view!.posts).toHaveLength(1);
    expect(view!.posts[0].title).toBe("Post A1");
    // Internal notes never leak
    expect(view!.posts[0]).not.toHaveProperty("internalNotes");
    // No cross-calendar leakage
    expect(view!.posts.some((p) => p.title === "Post B1")).toBe(false);
  });

  it("returns null for an unknown token", async () => {
    expect(await svc.getPublicView("does-not-exist")).toBeNull();
  });
});

describe("LocalStorageService — post lifecycle", () => {
  let svc: LocalStorageService;
  let calendarId: string;
  beforeEach(async () => {
    svc = freshService();
    const { calendar } = await svc.createClient({ name: "Cliente A" });
    calendarId = calendar.id;
  });

  it("records reschedule history and marks status when rescheduling", async () => {
    const post = await svc.createPost({
      calendarId,
      title: "P",
      date: "2026-06-10",
    });
    const moved = await svc.reschedulePost(post.id, "2026-06-20");
    expect(moved.date).toBe("2026-06-20");
    expect(moved.status).toBe("rescheduled");
    expect(moved.rescheduleHistory).toHaveLength(1);
    expect(moved.rescheduleHistory[0]).toMatchObject({
      from: "2026-06-10",
      to: "2026-06-20",
    });
  });

  it("records history when a normal edit changes the date", async () => {
    const post = await svc.createPost({
      calendarId,
      title: "P",
      date: "2026-06-10",
    });
    const edited = await svc.updatePost(post.id, { date: "2026-06-15" });
    expect(edited.rescheduleHistory).toHaveLength(1);
    expect(edited.rescheduleHistory[0].to).toBe("2026-06-15");
  });

  it("does not record history when the date is unchanged", async () => {
    const post = await svc.createPost({
      calendarId,
      title: "P",
      date: "2026-06-10",
    });
    const edited = await svc.updatePost(post.id, { title: "P2" });
    expect(edited.rescheduleHistory).toHaveLength(0);
    expect(edited.title).toBe("P2");
  });

  it("soft-deletes (keeps in storage) and restores", async () => {
    const post = await svc.createPost({
      calendarId,
      title: "P",
      date: "2026-06-10",
    });
    const del = await svc.deletePost(post.id);
    expect(del.status).toBe("deleted");
    const db = await svc.getDatabase();
    expect(db.posts.find((p) => p.id === post.id)).toBeTruthy(); // still present

    const restored = await svc.restorePost(post.id);
    expect(restored.status).toBe("todo");
  });
});

describe("LocalStorageService — auth", () => {
  beforeEach(() => localStorage.clear());

  it("logs in with the demo credentials and persists the session", async () => {
    const svc = new LocalStorageService();
    const session = await svc.login("admin@digitalclick.com", "nexa2026");
    expect(session.role).toBe("admin");
    expect(svc.getSession()?.email).toBe("admin@digitalclick.com");
    svc.logout();
    expect(svc.getSession()).toBeNull();
  });

  it("rejects invalid credentials", async () => {
    const svc = new LocalStorageService();
    await expect(svc.login("admin@digitalclick.com", "wrong")).rejects.toThrow();
  });
});

describe("LocalStorageService — stage automations", () => {
  let svc: LocalStorageService;
  let calendarId: string;
  beforeEach(async () => {
    svc = freshService();
    const { calendar } = await svc.createClient({ name: "Cliente A" });
    calendarId = calendar.id;
  });

  const draft = () => ({
    calendarId,
    active: true,
    trigger: { type: "entered_stage", stage: "done" } as const,
    action: { type: "send_for_review" } as const,
  });

  it("stores a rule and hands it back with the database", async () => {
    const rule = await svc.createAutomationRule(draft());
    expect(rule.id).toBeTruthy();
    expect(rule.createdAt).toBeTruthy();

    const db = await svc.getDatabase();
    expect(db.automationRules).toEqual([rule]);
  });

  it("refuses a rule for a calendar that does not exist", async () => {
    await expect(
      svc.createAutomationRule({ ...draft(), calendarId: "nope" }),
    ).rejects.toThrow(/Calendário não encontrado/);
  });

  it("refuses a rule that would move the post to the stage that triggered it", async () => {
    await expect(
      svc.createAutomationRule({
        ...draft(),
        action: { type: "move_to_stage", stage: "done" },
      }),
    ).rejects.toThrow(/mesma etapa/);
  });

  it("re-validates on edit, so a rule cannot be edited into nonsense", async () => {
    const rule = await svc.createAutomationRule(draft());
    await expect(
      svc.updateAutomationRule(rule.id, {
        action: { type: "move_to_stage", stage: "done" },
      }),
    ).rejects.toThrow(/mesma etapa/);

    // The stored rule is untouched by the rejected edit.
    const db = await svc.getDatabase();
    expect(db.automationRules?.[0].action).toEqual({ type: "send_for_review" });
  });

  it("pauses a rule without deleting it", async () => {
    const rule = await svc.createAutomationRule(draft());
    const paused = await svc.updateAutomationRule(rule.id, { active: false });
    expect(paused.active).toBe(false);
    expect((await svc.getDatabase()).automationRules).toEqual([paused]);
  });

  it("keeps the execution log when the rule itself is deleted", async () => {
    const rule = await svc.createAutomationRule(draft());
    const post = await svc.createPost({
      calendarId,
      title: "Post",
      date: "2026-06-10",
    });
    await svc.logAutomationRun({
      id: "run1",
      ruleId: rule.id,
      postId: post.id,
      at: "2026-06-10T10:00:00.000Z",
      result: "applied",
    });

    await svc.deleteAutomationRule(rule.id);
    expect((await svc.getDatabase()).automationRules).toEqual([]);
    expect(await svc.listAutomationRuns(calendarId)).toHaveLength(1);
  });

  it("lists only the runs of this calendar's posts, newest first", async () => {
    const mine = await svc.createPost({ calendarId, title: "Meu", date: "2026-06-10" });
    const other = await svc.createClient({ name: "Cliente B" });
    const theirs = await svc.createPost({
      calendarId: other.calendar.id,
      title: "Deles",
      date: "2026-06-10",
    });

    const run = (id: string, postId: string, at: string) => ({
      id,
      ruleId: "r1",
      postId,
      at,
      result: "applied" as const,
    });
    await svc.logAutomationRun(run("a", mine.id, "2026-06-10T10:00:00.000Z"));
    await svc.logAutomationRun(run("b", theirs.id, "2026-06-10T11:00:00.000Z"));
    await svc.logAutomationRun(run("c", mine.id, "2026-06-10T12:00:00.000Z"));

    expect((await svc.listAutomationRuns(calendarId)).map((r) => r.id)).toEqual([
      "c",
      "a",
    ]);
  });

  it("finds runs by event key — the lookup that prevents acting twice", async () => {
    const post = await svc.createPost({ calendarId, title: "Post", date: "2026-06-10" });
    await svc.logAutomationRun({
      id: "run1",
      ruleId: "r1",
      postId: post.id,
      at: "2026-06-10T10:00:00.000Z",
      result: "applied",
      eventKey: "decision:d1",
    });

    expect(await svc.findAutomationRuns([])).toEqual([]);
    expect(await svc.findAutomationRuns(["decision:d2"])).toEqual([]);
    expect(await svc.findAutomationRuns(["decision:d1"])).toHaveLength(1);
  });
});

describe("LocalStorageService — workspace do card (checklist, comentários, anexos, tempo)", () => {
  let svc: LocalStorageService;
  let calendarId: string;
  let token: string;
  let postId: string;

  beforeEach(async () => {
    svc = freshService();
    const { calendar } = await svc.createClient({ name: "Cliente A", email: "c@a.com" });
    calendarId = calendar.id;
    token = calendar.shareToken;
    postId = (await svc.createPost({ calendarId, title: "Post", date: "2026-06-10" })).id;
  });

  const workspace = {
    checklist: [{ id: "c1", text: "Gravar", done: true }],
    comments: [
      { id: "m1", author: "Ana", body: "trocar a capa", at: "2026-06-10T10:00:00.000Z" },
    ],
    attachments: [
      { id: "a1", name: "Briefing", url: "https://drive.google.com/x", at: "2026-06-10T10:00:00.000Z" },
    ],
    timeEntries: [{ id: "t1", minutes: 45, note: "edição", at: "2026-06-10T10:00:00.000Z" }],
  };

  it("stores and reads all four back", async () => {
    const saved = await svc.updatePost(postId, workspace);
    expect(saved.checklist).toEqual(workspace.checklist);
    expect(saved.comments).toEqual(workspace.comments);
    expect(saved.attachments).toEqual(workspace.attachments);
    expect(saved.timeEntries).toEqual(workspace.timeEntries);

    const db = await svc.getDatabase();
    expect(db.posts.find((p) => p.id === postId)?.checklist).toHaveLength(1);
  });

  it("leaves the other three alone when only one is patched", async () => {
    await svc.updatePost(postId, workspace);
    const saved = await svc.updatePost(postId, { checklist: [] });
    expect(saved.checklist).toEqual([]);
    expect(saved.comments).toEqual(workspace.comments);
    expect(saved.timeEntries).toEqual(workspace.timeEntries);
  });

  it("never lets any of it reach the client's view", async () => {
    await svc.updatePost(postId, { ...workspace, internalNotes: "segredo" });
    const view = await svc.getPublicView(token);
    const post = view!.posts.find((p) => p.id === postId)!;

    for (const field of ["checklist", "comments", "attachments", "timeEntries", "internalNotes"]) {
      expect(post).not.toHaveProperty(field);
    }
    // and nothing of it survives anywhere in the serialized payload
    const raw = JSON.stringify(view);
    expect(raw).not.toContain("trocar a capa");
    expect(raw).not.toContain("Briefing");
    expect(raw).not.toContain("edição");
    expect(raw).not.toContain("segredo");
  });
});
