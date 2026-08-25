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
