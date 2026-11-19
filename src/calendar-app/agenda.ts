import type {
  Appointment,
  Availability,
  Booking,
  MarkedDate,
  Post,
} from "./types";
import { toDayISO } from "./utils";

/**
 * Agenda (benchmark spec 04).
 *
 * The agenda is a *projection*: it owns almost nothing. Appointments and
 * bookings are its own, everything else — a post's publication date, a
 * pending approval — is read from the module that owns it. The spec's
 * acceptance test is that a projection rebuilt from scratch equals the
 * incremental one; the cheapest way to pass that test forever is to never
 * keep an incremental copy, which is what this does.
 *
 * Spec 04 also lists external calendar sync. The owner decided against it
 * (D7), so there is no `conexao_calendario` here: offering it would promise a
 * sync that never happens.
 */

export type AgendaItemKind =
  | "appointment"
  | "post"
  | "approval"
  | "booking"
  | "marked_date";

export interface AgendaItem {
  id: string;
  kind: AgendaItemKind;
  /** Day the item belongs to (YYYY-MM-DD). */
  date: string;
  /** Start time HH:MM when the item has one; all-day items have none. */
  time?: string;
  endTime?: string;
  title: string;
  color: string;
  clientId?: string;
  /** Where clicking the item should go. */
  refId: string;
  done: boolean;
  /** Past its day and still not done. Marked dates are never late. */
  late: boolean;
  /** Extra line shown on hover. */
  detail?: string;
}

const KIND_COLOR: Record<AgendaItemKind, string> = {
  appointment: "#8b5cf6",
  post: "#3b82f6",
  approval: "#f59e0b",
  booking: "#14b8a6",
  marked_date: "#94a3b8",
};

export function kindColor(kind: AgendaItemKind): string {
  return KIND_COLOR[kind];
}

export const KIND_LABEL: Record<AgendaItemKind, string> = {
  appointment: "Compromisso",
  post: "Publicação",
  approval: "Aprovação",
  booking: "Reserva",
  marked_date: "Data marcante",
};

// ── Projection ───────────────────────────────────────────────

export interface ProjectionSources {
  appointments: Appointment[];
  bookings: Booking[];
  posts: Post[];
  markedDates: MarkedDate[];
  /** Reference day for "late"; defaults to today. */
  today?: string;
}

/** Split an ISO datetime into day and HH:MM, in local time. */
export function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso.slice(0, 10), time: "" };
  return {
    date: toDayISO(d),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

/**
 * Build the agenda for a date range, from every source. Deterministic: the
 * same inputs always give the same list, in the same order.
 */
export function buildAgenda(
  from: string,
  to: string,
  sources: ProjectionSources,
): AgendaItem[] {
  const today = sources.today ?? toDayISO(new Date());
  const inRange = (day: string) => day >= from && day <= to;
  const items: AgendaItem[] = [];

  for (const a of sources.appointments) {
    if (a.status === "cancelado") continue;
    const start = splitDateTime(a.start);
    if (!inRange(start.date)) continue;
    items.push({
      id: `appointment:${a.id}`,
      kind: "appointment",
      date: start.date,
      time: start.time,
      endTime: splitDateTime(a.end).time,
      title: a.title,
      color: KIND_COLOR.appointment,
      clientId: a.clientId,
      refId: a.id,
      done: a.done === true,
      late: !a.done && start.date < today,
      detail: a.location,
    });
  }

  for (const b of sources.bookings) {
    if (b.status === "cancelada") continue;
    const start = splitDateTime(b.start);
    if (!inRange(start.date)) continue;
    items.push({
      id: `booking:${b.id}`,
      kind: "booking",
      date: start.date,
      time: start.time,
      endTime: splitDateTime(b.end).time,
      title: b.name,
      color: KIND_COLOR.booking,
      refId: b.id,
      done: start.date < today,
      late: false, // a booking in the past simply happened
      detail: b.email,
    });
  }

  for (const p of sources.posts) {
    if (p.status === "deleted") continue;
    if (!inRange(p.date)) continue;
    const published = p.status === "published";
    items.push({
      id: `post:${p.id}`,
      kind: "post",
      date: p.date,
      title: p.title,
      color: KIND_COLOR.post,
      clientId: undefined,
      refId: p.id,
      done: published,
      late: !published && p.date < today,
      detail: p.contentType,
    });
    // A post waiting on the client is its own line: it is work on someone
    // else's desk, and that is exactly what an agenda should surface.
    if (p.approval && p.approval.round > 0) {
      const decided = p.approval.decisions.some((d) => d.round === p.approval!.round);
      if (!decided) {
        items.push({
          id: `approval:${p.id}`,
          kind: "approval",
          date: p.date,
          title: `Aprovação pendente: ${p.title}`,
          color: KIND_COLOR.approval,
          refId: p.id,
          done: false,
          late: p.date < today,
        });
      }
    }
  }

  for (const m of sources.markedDates) {
    if (!inRange(m.date)) continue;
    items.push({
      id: `marked:${m.id}`,
      kind: "marked_date",
      date: m.date,
      title: m.name,
      color: m.color ?? KIND_COLOR.marked_date,
      refId: m.id,
      done: false,
      late: false, // a date on the calendar is never "overdue"
      detail: m.category,
    });
  }

  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.title.localeCompare(b.title),
  );
}

export interface AgendaCounts {
  total: number;
  done: number;
  late: number;
  byKind: Record<AgendaItemKind, number>;
}

export function countAgenda(items: AgendaItem[]): AgendaCounts {
  const byKind = {
    appointment: 0,
    post: 0,
    approval: 0,
    booking: 0,
    marked_date: 0,
  } as Record<AgendaItemKind, number>;
  let done = 0;
  let late = 0;
  for (const i of items) {
    byKind[i.kind] += 1;
    if (i.done) done += 1;
    if (i.late) late += 1;
  }
  return { total: items.length, done, late, byKind };
}

// ── Availability and free slots ──────────────────────────────

/**
 * Business hours, as the starting point an agency can change.
 *
 * It lives here rather than in each caller because a blank default is a trap:
 * the settings panel would save "no days at all" on first use and the booking
 * page would correctly offer nothing.
 */
export const DEFAULT_AVAILABILITY: Availability = {
  weekdays: {
    1: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
    2: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
    3: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
    4: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
    5: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
  },
  durationMinutes: 30,
  noticeHours: 12,
  gapMinutes: 15,
};

export interface Slot {
  start: string; // ISO
  end: string; // ISO
}

/** Minutes since midnight for "HH:MM". */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(day: string, minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${day}T${h}:${m}:00`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Free slots for one day.
 *
 * Offered times exclude anything already booked or scheduled, and anything
 * inside the minimum notice. The gap between bookings is applied around busy
 * blocks, not only after them: a 15-minute buffer that only protects the end
 * of a meeting is not a buffer.
 */
export function freeSlots(
  day: string,
  availability: Availability,
  busy: Slot[],
  now: Date = new Date(),
): Slot[] {
  const weekday = new Date(`${day}T12:00:00`).getDay();
  const windows = availability.weekdays[weekday] ?? [];
  if (windows.length === 0) return [];

  const duration = availability.durationMinutes;
  const gap = availability.gapMinutes ?? 0;
  const noticeLimit = new Date(now.getTime() + (availability.noticeHours ?? 0) * 3600_000);

  const busyRanges = busy
    .map((b) => {
      const s = splitDateTime(b.start);
      const e = splitDateTime(b.end);
      if (s.date !== day && e.date !== day) return null;
      return {
        start: s.date === day ? toMinutes(s.time) : 0,
        end: e.date === day ? toMinutes(e.time) : 24 * 60,
      };
    })
    .filter((r): r is { start: number; end: number } => r !== null);

  const slots: Slot[] = [];
  for (const w of windows) {
    const windowStart = toMinutes(w.start);
    const windowEnd = toMinutes(w.end);
    for (let t = windowStart; t + duration <= windowEnd; t += duration) {
      const clash = busyRanges.some((b) =>
        overlaps(t - gap, t + duration + gap, b.start, b.end),
      );
      if (clash) continue;
      const startISO = fromMinutes(day, t);
      if (new Date(startISO) < noticeLimit) continue; // inside the notice window
      slots.push({ start: startISO, end: fromMinutes(day, t + duration) });
    }
  }
  return slots;
}

/** Whether a proposed slot clashes with anything already in the diary. */
export function hasConflict(slot: Slot, busy: Slot[]): boolean {
  const s = new Date(slot.start).getTime();
  const e = new Date(slot.end).getTime();
  return busy.some((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return s < be && bs < e;
  });
}

export function validateAppointment(input: {
  title: string;
  start: string;
  end: string;
}): string | null {
  if (!input.title.trim()) return "Informe o título do compromisso.";
  if (!input.start || !input.end) return "Informe início e fim.";
  if (new Date(input.end) <= new Date(input.start))
    return "O fim precisa ser depois do início.";
  return null;
}

export function validateBooking(input: { name: string; email: string }): string | null {
  if (!input.name.trim()) return "Informe seu nome.";
  const email = input.email.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return "Informe um e-mail válido.";
  return null;
}
