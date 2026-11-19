import { describe, expect, it } from "vitest";
import {
  buildAgenda,
  countAgenda,
  freeSlots,
  hasConflict,
  splitDateTime,
  toMinutes,
  validateAppointment,
  validateBooking,
} from "./agenda";
import type { Appointment, Availability, Booking, MarkedDate, Post } from "./types";

const appointment = (over: Partial<Appointment> = {}): Appointment => ({
  id: "a1",
  title: "Reunião de pauta",
  start: "2026-06-10T14:00:00",
  end: "2026-06-10T15:00:00",
  status: "marcado",
  source: "manual",
  createdAt: "t",
  ...over,
});

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

const sources = (over: Partial<Parameters<typeof buildAgenda>[2]> = {}) => ({
  appointments: [] as Appointment[],
  bookings: [] as Booking[],
  posts: [] as Post[],
  markedDates: [] as MarkedDate[],
  today: "2026-06-10",
  ...over,
});

describe("buildAgenda", () => {
  it("gathers every source into one ordered list", () => {
    const items = buildAgenda("2026-06-01", "2026-06-30", sources({
      appointments: [appointment()],
      posts: [post({ id: "p1", title: "Reels", date: "2026-06-12" })],
      markedDates: [
        { id: "m1", date: "2026-06-12", name: "Dia dos Namorados", category: "Data comercial" },
      ],
    }));
    expect(items.map((i) => i.id)).toEqual([
      "appointment:a1",
      "marked:m1",
      "post:p1",
    ]);
  });

  it("is deterministic — the same sources always rebuild the same agenda", () => {
    const src = sources({ appointments: [appointment()], posts: [post()] });
    expect(buildAgenda("2026-06-01", "2026-06-30", src)).toEqual(
      buildAgenda("2026-06-01", "2026-06-30", src),
    );
  });

  it("keeps out what falls outside the range", () => {
    const items = buildAgenda("2026-06-01", "2026-06-05", sources({
      appointments: [appointment()],
    }));
    expect(items).toEqual([]);
  });

  it("leaves cancelled appointments and deleted posts out", () => {
    const items = buildAgenda("2026-06-01", "2026-06-30", sources({
      appointments: [appointment({ status: "cancelado" })],
      posts: [post({ status: "deleted" })],
    }));
    expect(items).toEqual([]);
  });

  it("marks a past, unfinished item as late — and a finished one as not", () => {
    const items = buildAgenda("2026-06-01", "2026-06-30", sources({
      posts: [
        post({ id: "late", date: "2026-06-01" }),
        post({ id: "ok", date: "2026-06-01", status: "published" }),
      ],
    }));
    expect(items.find((i) => i.refId === "late")?.late).toBe(true);
    expect(items.find((i) => i.refId === "ok")?.late).toBe(false);
    expect(items.find((i) => i.refId === "ok")?.done).toBe(true);
  });

  it("never calls a marked date late", () => {
    const items = buildAgenda("2026-06-01", "2026-06-30", sources({
      markedDates: [{ id: "m1", date: "2026-06-01", name: "Finados", category: "x" }],
    }));
    expect(items[0].late).toBe(false);
  });

  it("raises a line of its own for a post waiting on the client", () => {
    const waiting = post({
      id: "p9",
      approval: { round: 1, decisions: [] },
    });
    const items = buildAgenda("2026-06-01", "2026-06-30", sources({ posts: [waiting] }));
    expect(items.map((i) => i.kind)).toContain("approval");
  });

  it("drops the approval line once the client has decided that round", () => {
    const decided = post({
      id: "p9",
      approval: {
        round: 1,
        decisions: [
          { id: "d1", round: 1, result: "approved", verified: true, at: "2026-06-09T10:00:00Z" },
        ],
      },
    });
    const items = buildAgenda("2026-06-01", "2026-06-30", sources({ posts: [decided] }));
    expect(items.map((i) => i.kind)).not.toContain("approval");
  });

  it("counts the period by kind, done and late", () => {
    const items = buildAgenda("2026-06-01", "2026-06-30", sources({
      appointments: [appointment()],
      posts: [post({ id: "a", date: "2026-06-01" }), post({ id: "b", status: "published" })],
    }));
    const counts = countAgenda(items);
    expect(counts.total).toBe(3);
    expect(counts.done).toBe(1);
    expect(counts.late).toBe(1);
    expect(counts.byKind.post).toBe(2);
  });
});

describe("splitDateTime", () => {
  it("splits an ISO datetime into day and clock", () => {
    expect(splitDateTime("2026-06-10T14:30:00")).toEqual({
      date: "2026-06-10",
      time: "14:30",
    });
  });
  it("survives a value it cannot parse", () => {
    expect(splitDateTime("not a date").date).toBe("not a date");
  });
});

describe("freeSlots", () => {
  const availability: Availability = {
    // Wednesday 09:00–12:00
    weekdays: { 3: [{ start: "09:00", end: "12:00" }] },
    durationMinutes: 60,
    noticeHours: 0,
    gapMinutes: 0,
  };
  const wednesday = "2026-06-10";
  const past = new Date("2026-06-01T00:00:00");

  it("offers one slot per duration inside the window", () => {
    const slots = freeSlots(wednesday, availability, [], past);
    expect(slots.map((s) => s.start)).toEqual([
      "2026-06-10T09:00:00",
      "2026-06-10T10:00:00",
      "2026-06-10T11:00:00",
    ]);
  });

  it("offers nothing on a day with no window", () => {
    expect(freeSlots("2026-06-11", availability, [], past)).toEqual([]);
  });

  it("leaves out a slot that is already taken", () => {
    const busy = [{ start: "2026-06-10T10:00:00", end: "2026-06-10T11:00:00" }];
    expect(freeSlots(wednesday, availability, busy, past).map((s) => s.start)).toEqual([
      "2026-06-10T09:00:00",
      "2026-06-10T11:00:00",
    ]);
  });

  it("keeps the buffer on both sides of a busy block, not only after it", () => {
    const withGap = { ...availability, gapMinutes: 15 };
    const busy = [{ start: "2026-06-10T10:00:00", end: "2026-06-10T11:00:00" }];
    // 09:00 would end at 10:00, inside the 15-minute buffer before the
    // meeting, so it goes too.
    expect(freeSlots(wednesday, withGap, busy, past).map((s) => s.start)).toEqual([]);
  });

  it("honours the minimum notice", () => {
    const notice = { ...availability, noticeHours: 2 };
    // 08:30 + 2h of notice = nothing before 10:30, so only 11:00 survives.
    const slots = freeSlots(wednesday, notice, [], new Date("2026-06-10T08:30:00"));
    expect(slots.map((s) => s.start)).toEqual(["2026-06-10T11:00:00"]);
  });

  it("offers nothing at all when the notice swallows the whole day", () => {
    const notice = { ...availability, noticeHours: 12 };
    expect(freeSlots(wednesday, notice, [], new Date("2026-06-10T00:00:00"))).toEqual([]);
  });

  it("handles several windows in one day", () => {
    const split: Availability = {
      ...availability,
      weekdays: { 3: [{ start: "09:00", end: "10:00" }, { start: "14:00", end: "15:00" }] },
    };
    expect(freeSlots(wednesday, split, [], past).map((s) => s.start)).toEqual([
      "2026-06-10T09:00:00",
      "2026-06-10T14:00:00",
    ]);
  });
});

describe("hasConflict", () => {
  const busy = [{ start: "2026-06-10T10:00:00", end: "2026-06-10T11:00:00" }];

  it("sees an overlap, however small", () => {
    expect(hasConflict({ start: "2026-06-10T10:30:00", end: "2026-06-10T11:30:00" }, busy)).toBe(true);
    expect(hasConflict({ start: "2026-06-10T09:30:00", end: "2026-06-10T10:30:00" }, busy)).toBe(true);
  });

  it("lets a slot that merely touches the edge through", () => {
    expect(hasConflict({ start: "2026-06-10T11:00:00", end: "2026-06-10T12:00:00" }, busy)).toBe(false);
    expect(hasConflict({ start: "2026-06-10T09:00:00", end: "2026-06-10T10:00:00" }, busy)).toBe(false);
  });
});

describe("validation", () => {
  it("refuses an appointment that ends before it starts", () => {
    expect(
      validateAppointment({
        title: "x",
        start: "2026-06-10T15:00:00",
        end: "2026-06-10T14:00:00",
      }),
    ).toBeTruthy();
    expect(
      validateAppointment({
        title: "x",
        start: "2026-06-10T14:00:00",
        end: "2026-06-10T14:00:00",
      }),
    ).toBeTruthy();
    expect(
      validateAppointment({
        title: "x",
        start: "2026-06-10T14:00:00",
        end: "2026-06-10T15:00:00",
      }),
    ).toBeNull();
  });

  it("refuses a booking without a name or a sane e-mail", () => {
    expect(validateBooking({ name: " ", email: "a@b.com" })).toBeTruthy();
    expect(validateBooking({ name: "Ana", email: "nope" })).toBeTruthy();
    expect(validateBooking({ name: "Ana", email: "ana@exemplo.com" })).toBeNull();
  });
});

describe("toMinutes", () => {
  it("reads a clock time", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("23:59")).toBe(1439);
  });
});
