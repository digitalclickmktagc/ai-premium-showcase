import { describe, expect, it } from "vitest";
import {
  buildDayWork,
  buildPerformance,
  buildTimesheet,
  countWork,
  firstSteps,
  setupComplete,
} from "./daily";
import type { Contract, CrmTask, Deal, FinanceEntry, Post, Proposal } from "./types";

const post = (over: Partial<Post> = {}): Post => ({
  id: "p1",
  calendarId: "cal1",
  title: "Post",
  date: "2026-06-10",
  status: "todo",
  description: "",
  rescheduleHistory: [],
  createdAt: "t",
  updatedAt: "t",
  ...over,
});

const sources = (over: Partial<Parameters<typeof buildDayWork>[0]> = {}) => ({
  posts: [] as Post[],
  appointments: [],
  bookings: [],
  markedDates: [],
  crmTasks: [] as CrmTask[],
  deals: [] as Deal[],
  entries: [] as FinanceEntry[],
  proposals: [] as Proposal[],
  contracts: [] as Contract[],
  today: "2026-06-10",
  ...over,
});

describe("buildDayWork", () => {
  it("gathers what is late, due and waiting", () => {
    const work = buildDayWork(
      sources({
        posts: [
          post({ id: "late", date: "2026-06-01" }),
          post({ id: "today", date: "2026-06-10" }),
          post({ id: "done", date: "2026-06-01", status: "published" }),
        ],
        crmTasks: [
          { id: "t1", dealId: "d1", title: "Ligar", dueOn: "2026-06-09" },
          { id: "t2", dealId: "d1", title: "Depois", dueOn: "2026-07-01" },
        ],
        entries: [
          { id: "e1", nature: "despesa", description: "Aluguel", amount: 100, dueDate: "2026-06-10", competence: "2026-06", status: "pendente", origin: "manual", createdAt: "t" },
          { id: "e2", nature: "despesa", description: "Atrasada", amount: 100, dueDate: "2026-06-01", competence: "2026-06", status: "pendente", origin: "manual", createdAt: "t" },
        ],
      }),
    );

    expect(work.latePosts.map((p) => p.id)).toEqual(["late"]);
    expect(work.crmTasks.map((t) => t.id)).toEqual(["t1"]);
    expect(work.financeDue.map((e) => e.id)).toEqual(["e1"]);
    expect(work.financeOverdue.map((e) => e.id)).toEqual(["e2"]);
  });

  it("lists posts sitting on the client's desk", () => {
    const waiting = post({ id: "w", approval: { round: 1, decisions: [] } });
    const decided = post({
      id: "d",
      approval: {
        round: 1,
        decisions: [{ id: "x", round: 1, result: "approved", verified: true, at: "t" }],
      },
    });
    const work = buildDayWork(sources({ posts: [waiting, decided] }));
    expect(work.waitingClient.map((p) => p.id)).toEqual(["w"]);
  });

  it("flags only the contracts where the agency is the hold-up", () => {
    const base = (over: Partial<Contract>): Contract => ({
      id: "c1",
      title: "Contrato",
      status: "parcialmente_assinado",
      finalText: "x",
      textHash: "h",
      autoRenew: false,
      renewNoticeDays: 30,
      parties: [
        { id: "pa1", role: "contratante", name: "Cliente", order: 0, required: true, token: "a" },
        { id: "pa2", role: "contratada", name: "Agência", order: 1, required: true, token: "b" },
      ],
      signatures: [],
      createdAt: "t",
      ...over,
    });

    const mine = base({
      signatures: [
        { id: "s", partyId: "pa1", typedName: "C", typedDocument: "1", at: "t", signedTextHash: "h" },
      ],
    });
    const theirs = base({
      signatures: [
        { id: "s", partyId: "pa2", typedName: "A", typedDocument: "1", at: "t", signedTextHash: "h" },
      ],
    });

    const work = buildDayWork(sources({ contracts: [mine, theirs] }));
    expect(work.contractsToSign.map((c) => c.id)).toEqual(["c1"]);
    expect(buildDayWork(sources({ contracts: [theirs] })).contractsToSign).toEqual([]);
  });

  it("counts only what still needs doing", () => {
    const work = buildDayWork(
      sources({
        posts: [post({ id: "late", date: "2026-06-01" }), post({ id: "today" })],
      }),
    );
    // the late post counts twice on purpose: once as agenda, once as late.
    expect(countWork(work)).toBeGreaterThan(0);
    expect(countWork(buildDayWork(sources()))).toBe(0);
  });
});

describe("timesheet", () => {
  const withTime = (id: string, calendarId: string, entries: [number, string][]) =>
    post({
      id,
      calendarId,
      title: `Post ${id}`,
      timeEntries: entries.map(([minutes, at], i) => ({ id: `${id}-${i}`, minutes, at })),
    });

  const posts = [
    withTime("a", "cal1", [
      [60, "2026-06-10T10:00:00Z"],
      [30, "2026-06-10T15:00:00Z"],
    ]),
    withTime("b", "cal2", [[90, "2026-06-11T10:00:00Z"]]),
    withTime("c", "cal1", [[45, "2026-05-01T10:00:00Z"]]),
  ];

  it("adds up the hours already logged on the cards", () => {
    const sheet = buildTimesheet(posts, { from: "2026-06-01", to: "2026-06-30" });
    expect(sheet.totalMinutes).toBe(180);
    expect(sheet.rows).toHaveLength(3);
  });

  it("keeps out what falls outside the period", () => {
    const sheet = buildTimesheet(posts, { from: "2026-06-01", to: "2026-06-30" });
    expect(sheet.rows.some((r) => r.postId === "c")).toBe(false);
  });

  it("splits by client and by day", () => {
    const sheet = buildTimesheet(posts, { from: "2026-06-01", to: "2026-06-30" });
    expect(sheet.byCalendar).toEqual([
      { calendarId: "cal2", minutes: 90 },
      { calendarId: "cal1", minutes: 90 },
    ]);
    expect(sheet.byDay).toEqual([
      { date: "2026-06-10", minutes: 90 },
      { date: "2026-06-11", minutes: 90 },
    ]);
  });

  it("narrows to one client when asked", () => {
    const sheet = buildTimesheet(posts, {
      from: "2026-06-01",
      to: "2026-06-30",
      calendarId: "cal1",
    });
    expect(sheet.totalMinutes).toBe(90);
  });

  it("has nothing to show when nobody logged anything", () => {
    const sheet = buildTimesheet([post()], { from: "2026-06-01", to: "2026-06-30" });
    expect(sheet).toMatchObject({ totalMinutes: 0, rows: [], byDay: [], byCalendar: [] });
  });
});

describe("performance", () => {
  const period = { from: "2026-06-01", to: "2026-06-30" };

  it("counts a post published without ever moving as on time", () => {
    const perf = buildPerformance(
      [
        post({ id: "a", status: "published" }),
        post({
          id: "b",
          status: "published",
          rescheduleHistory: [{ from: "2026-06-05", to: "2026-06-10", at: "t" }],
        }),
      ],
      period,
    );
    expect(perf.published).toBe(2);
    expect(perf.onTime).toBe(1);
    expect(perf.onTimeRate).toBe(50);
    expect(perf.rescheduled).toBe(1);
  });

  it("measures how often the client approved on the first round", () => {
    const first = post({
      id: "a",
      approval: {
        round: 1,
        decisions: [{ id: "d", round: 1, result: "approved", verified: true, at: "t" }],
      },
    });
    const second = post({
      id: "b",
      approval: {
        round: 2,
        decisions: [
          { id: "d1", round: 1, result: "changes", comment: "trocar", verified: true, at: "t" },
          { id: "d2", round: 2, result: "approved", verified: true, at: "t" },
        ],
      },
    });
    const perf = buildPerformance([first, second], period);
    expect(perf.approvedFirstTime).toBe(1);
    expect(perf.approvalRate).toBe(50);
  });

  it("gives null rather than a made-up zero when there is nothing to divide", () => {
    const perf = buildPerformance([], period);
    expect(perf.onTimeRate).toBeNull();
    expect(perf.approvalRate).toBeNull();
    expect(perf.minutesPerPost).toBeNull();
  });

  it("averages the logged time over what was published", () => {
    const perf = buildPerformance(
      [
        post({ id: "a", status: "published", timeEntries: [{ id: "1", minutes: 60, at: "t" }] }),
        post({ id: "b", status: "published", timeEntries: [{ id: "2", minutes: 120, at: "t" }] }),
      ],
      period,
    );
    expect(perf.minutes).toBe(180);
    expect(perf.minutesPerPost).toBe(90);
  });

  it("leaves deleted posts and other periods out", () => {
    const perf = buildPerformance(
      [
        post({ id: "gone", status: "deleted" }),
        post({ id: "old", status: "published", date: "2026-01-01" }),
      ],
      period,
    );
    expect(perf.published).toBe(0);
  });
});

describe("first steps", () => {
  const empty = { clients: [], calendars: [], posts: [], services: [], accounts: [] };

  it("starts with everything undone", () => {
    const steps = firstSteps(empty);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(setupComplete(steps)).toBe(false);
  });

  it("ticks each step off as the thing exists", () => {
    const steps = firstSteps({
      clients: [{ id: "c" }] as never,
      calendars: [{ id: "cal" }] as never,
      posts: [post({ approval: { round: 1, decisions: [] } })],
      services: [{ id: "s" }] as never,
      accounts: [{ id: "a" }],
    });
    expect(setupComplete(steps)).toBe(true);
  });

  it("does not count a deleted post as a first post", () => {
    const steps = firstSteps({ ...empty, posts: [post({ status: "deleted" })] });
    expect(steps.find((s) => s.key === "post")?.done).toBe(false);
  });
});
