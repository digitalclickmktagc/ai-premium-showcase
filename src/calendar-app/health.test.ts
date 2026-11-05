import { describe, expect, it } from "vitest";
import {
  CLIENT_STATUS_LABEL,
  canTransition,
  clientHealth,
  healthTone,
  isOperational,
  lastClientInteraction,
  normalizeStatus,
} from "./health";
import type { Post } from "./types";

const TODAY = "2026-11-05";

const post = (over: Partial<Post> = {}): Post => ({
  id: Math.random().toString(36).slice(2),
  calendarId: "cal1",
  title: "P",
  date: "2026-11-01",
  status: "todo",
  description: "",
  rescheduleHistory: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

const decided = (result: "approved" | "rejected" | "changes", at: string): Post =>
  post({
    status: "done",
    approval: {
      round: 1,
      decisions: [{ id: "d", round: 1, result, verified: true, at }],
    },
  });

describe("clientHealth — formula and breakdown", () => {
  it("is 100 with nothing wrong", () => {
    const recent = decided("approved", "2026-11-04T10:00:00.000Z");
    const h = clientHealth([recent], { today: TODAY });
    expect(h.value).toBe(100);
    expect(h.signals).toHaveLength(0);
  });

  it("removes 5 per overdue post", () => {
    const posts = [post({ date: "2026-11-01" }), post({ date: "2026-11-02" })];
    const h = clientHealth(posts, { today: TODAY, clientCreatedAt: "2026-11-04" });
    expect(h.signals.find((s) => s.key === "overdue")?.points).toBe(-10);
    expect(h.value).toBe(90);
  });

  it("caps the overdue penalty at -30", () => {
    const posts = Array.from({ length: 10 }, () => post({ date: "2026-10-01" }));
    const h = clientHealth(posts, { today: TODAY, clientCreatedAt: "2026-11-04" });
    expect(h.signals.find((s) => s.key === "overdue")?.points).toBe(-30);
  });

  it("does not count a post that is merely scheduled for the future", () => {
    const h = clientHealth([post({ date: "2026-12-01" })], {
      today: TODAY,
      clientCreatedAt: "2026-11-04",
    });
    expect(h.signals.find((s) => s.key === "overdue")).toBeUndefined();
  });

  it("removes 10 per recent rejection, capped at -20", () => {
    const posts = [
      decided("rejected", "2026-11-01T10:00:00.000Z"),
      decided("rejected", "2026-11-02T10:00:00.000Z"),
      decided("rejected", "2026-11-03T10:00:00.000Z"),
    ];
    const h = clientHealth(posts, { today: TODAY });
    expect(h.signals.find((s) => s.key === "rejected")?.points).toBe(-20);
  });

  it("ignores a rejection older than the window", () => {
    const old = decided("rejected", "2026-09-01T10:00:00.000Z"); // > 30 days
    const h = clientHealth([old], { today: TODAY });
    expect(h.signals.find((s) => s.key === "rejected")).toBeUndefined();
  });

  it("removes 15 after 21 days of silence", () => {
    const quiet = decided("approved", "2026-10-01T10:00:00.000Z"); // 35 days ago
    const h = clientHealth([quiet], { today: TODAY });
    const silence = h.signals.find((s) => s.key === "silence");
    expect(silence?.points).toBe(-15);
    expect(silence?.label).toMatch(/35 dias/);
  });

  it("falls back to the client's start date when they never interacted", () => {
    const h = clientHealth([], { today: TODAY, clientCreatedAt: "2026-01-01" });
    expect(h.signals.find((s) => s.key === "silence")?.points).toBe(-15);
  });

  it("stacks signals and never goes below zero", () => {
    const posts = [
      ...Array.from({ length: 10 }, () => post({ date: "2026-10-01" })), // -30
      decided("rejected", "2026-11-01T10:00:00.000Z"), // -10
      decided("rejected", "2026-11-02T10:00:00.000Z"), // -10 → capped -20
    ];
    const h = clientHealth(posts, { today: TODAY });
    expect(h.value).toBeGreaterThanOrEqual(0);
    expect(h.value).toBe(50); // 100 - 30 - 20, interaction is recent
  });

  it("explains itself — every penalty is an itemised signal", () => {
    const posts = [post({ date: "2026-10-01" }), decided("rejected", "2026-11-01T00:00:00.000Z")];
    const h = clientHealth(posts, { today: TODAY });
    const total = h.signals.reduce((s, x) => s + x.points, 0);
    expect(h.value).toBe(Math.max(0, 100 + total));
    h.signals.forEach((s) => expect(s.label.length).toBeGreaterThan(0));
  });
});

describe("lastClientInteraction", () => {
  it("returns the most recent decision across posts", () => {
    const posts = [
      decided("approved", "2026-10-01T10:00:00.000Z"),
      decided("changes", "2026-11-02T10:00:00.000Z"),
    ];
    expect(lastClientInteraction(posts)).toBe("2026-11-02T10:00:00.000Z");
  });

  it("is undefined when the client never decided anything", () => {
    expect(lastClientInteraction([post()])).toBeUndefined();
  });
});

describe("healthTone", () => {
  it("bands the score", () => {
    expect(healthTone(100).label).toBe("Saudável");
    expect(healthTone(80).label).toBe("Saudável");
    expect(healthTone(79).label).toBe("Atenção");
    expect(healthTone(50).label).toBe("Atenção");
    expect(healthTone(49).label).toBe("Crítico");
    expect(healthTone(0).label).toBe("Crítico");
  });
});

describe("client lifecycle", () => {
  it("allows the transitions the spec lists", () => {
    expect(canTransition("active", "paused")).toBe(true);
    expect(canTransition("paused", "active")).toBe(true);
    expect(canTransition("ended", "active")).toBe(true); // reactivate
    expect(canTransition("archived", "active")).toBe(true);
    expect(canTransition("active", "archived")).toBe(true);
  });

  it("refuses to go straight from ended to paused", () => {
    expect(canTransition("ended", "paused")).toBe(false);
    expect(canTransition("archived", "ended")).toBe(false);
  });

  it("treats active and paused as operational", () => {
    expect(isOperational("active")).toBe(true);
    expect(isOperational("paused")).toBe(true);
    expect(isOperational("ended")).toBe(false);
    expect(isOperational("archived")).toBe(false);
  });

  it("labels every status", () => {
    (["active", "paused", "ended", "archived"] as const).forEach((s) =>
      expect(CLIENT_STATUS_LABEL[s]).toBeTruthy(),
    );
  });

  it("maps legacy records that only stored the boolean", () => {
    expect(normalizeStatus({ active: true })).toBe("active");
    expect(normalizeStatus({ active: false })).toBe("paused");
    expect(normalizeStatus({ status: "ended", active: false })).toBe("ended");
  });
});
