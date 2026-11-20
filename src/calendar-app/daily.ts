import type {
  Appointment,
  Booking,
  Calendar,
  Client,
  Contract,
  CrmTask,
  Deal,
  FinanceEntry,
  MarkedDate,
  Post,
  Proposal,
  Service,
} from "./types";
import { buildAgenda, type AgendaItem } from "./agenda";
import { approvalState } from "./approval";
import { pendingParties } from "./contracts";
import { withoutNextStep } from "./crm";
import { expiringSoon, isExpired } from "./proposals";
import { totalMinutes } from "./cards";
import { todayISO } from "./utils";

/**
 * The day's panel, the timesheet and the performance figures
 * (benchmark spec 19 / ficha 19).
 *
 * Everything here is computed from what the other modules already store.
 * There is no "today" table and no counters kept in step by hand: a number
 * that can disagree with the thing it counts is worse than no number.
 *
 * The rewards programme from the same sheet is deliberately absent. Its own
 * critique says it best — paying coins per task completed rewards splitting
 * tasks up, which is the opposite of what an agency wants.
 */

export interface DayWork {
  agenda: AgendaItem[];
  /** Posts whose day has passed and are not published. */
  latePosts: Post[];
  /** Sent to the client and still waiting on them. */
  waitingClient: Post[];
  crmTasks: CrmTask[];
  dealsNoNextStep: Deal[];
  financeDue: FinanceEntry[];
  financeOverdue: FinanceEntry[];
  proposalsExpiring: Proposal[];
  /** Contracts where the agency itself is the one holding things up. */
  contractsToSign: Contract[];
}

export interface DaySources {
  posts: Post[];
  appointments: Appointment[];
  bookings: Booking[];
  markedDates: MarkedDate[];
  crmTasks: CrmTask[];
  deals: Deal[];
  entries: FinanceEntry[];
  proposals: Proposal[];
  contracts: Contract[];
  today?: string;
}

export function buildDayWork(sources: DaySources): DayWork {
  const today = sources.today ?? todayISO();

  const agenda = buildAgenda(today, today, {
    appointments: sources.appointments,
    bookings: sources.bookings,
    posts: sources.posts,
    markedDates: sources.markedDates,
    today,
  });

  const latePosts = sources.posts
    .filter((p) => p.status !== "published" && p.status !== "deleted" && p.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const waitingClient = sources.posts.filter(
    (p) => p.status !== "deleted" && approvalState(p.approval) === "pending",
  );

  const crmTasks = sources.crmTasks
    .filter((t) => !t.doneAt && t.dueOn <= today)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  const financeOpen = sources.entries.filter(
    (e) => e.status === "pendente" || e.status === "previsto",
  );

  return {
    agenda,
    latePosts,
    waitingClient,
    crmTasks,
    dealsNoNextStep: withoutNextStep(sources.deals, sources.crmTasks),
    financeDue: financeOpen.filter((e) => e.dueDate === today),
    financeOverdue: financeOpen
      .filter((e) => e.dueDate < today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    proposalsExpiring: sources.proposals.filter(
      (p) => expiringSoon(p, today) || isExpired(p, today),
    ),
    // "Needs my signature": every other required party has signed and the
    // agency has not. That is the one case where the hold-up is in-house.
    contractsToSign: sources.contracts.filter((c) => {
      const pending = pendingParties(c);
      return pending.length === 1 && pending[0].role === "contratada";
    }),
  };
}

/** How many things actually need a person today. */
export function countWork(work: DayWork): number {
  return (
    work.agenda.filter((i) => !i.done).length +
    work.latePosts.length +
    work.crmTasks.length +
    work.financeDue.length +
    work.financeOverdue.length +
    work.contractsToSign.length
  );
}

// ── Timesheet ────────────────────────────────────────────────

export interface TimesheetRow {
  date: string;
  postId: string;
  postTitle: string;
  calendarId: string;
  minutes: number;
  note?: string;
}

export interface Timesheet {
  rows: TimesheetRow[];
  totalMinutes: number;
  byCalendar: { calendarId: string; minutes: number }[];
  byDay: { date: string; minutes: number }[];
}

/**
 * Hours logged on cards, gathered up.
 *
 * The time already lives on the card where the work happened; this only adds
 * it up. Nothing is written, so a timesheet can never drift from the cards
 * it is made of.
 */
export function buildTimesheet(
  posts: Post[],
  { from, to, calendarId }: { from: string; to: string; calendarId?: string },
): Timesheet {
  const rows: TimesheetRow[] = [];

  for (const post of posts) {
    if (calendarId && post.calendarId !== calendarId) continue;
    for (const entry of post.timeEntries ?? []) {
      const date = entry.at.slice(0, 10);
      if (date < from || date > to) continue;
      rows.push({
        date,
        postId: post.id,
        postTitle: post.title,
        calendarId: post.calendarId,
        minutes: entry.minutes,
        note: entry.note,
      });
    }
  }

  rows.sort((a, b) => b.date.localeCompare(a.date) || a.postTitle.localeCompare(b.postTitle));

  const sumBy = <K extends string>(key: (r: TimesheetRow) => K) => {
    const map = new Map<K, number>();
    for (const r of rows) map.set(key(r), (map.get(key(r)) ?? 0) + r.minutes);
    return map;
  };

  return {
    rows,
    totalMinutes: rows.reduce((sum, r) => sum + r.minutes, 0),
    byCalendar: [...sumBy((r) => r.calendarId)]
      .map(([calendarId, minutes]) => ({ calendarId, minutes }))
      .sort((a, b) => b.minutes - a.minutes),
    byDay: [...sumBy((r) => r.date)]
      .map(([date, minutes]) => ({ date, minutes }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ── Performance ──────────────────────────────────────────────

export interface Performance {
  published: number;
  /** Published on or before the day they were scheduled for. */
  onTime: number;
  onTimeRate: number | null;
  rescheduled: number;
  approvedFirstTime: number;
  approvalRate: number | null;
  minutes: number;
  /** Average minutes per published post, when there is any time logged. */
  minutesPerPost: number | null;
}

/**
 * How the period went.
 *
 * "On time" counts a post that was published without ever being moved: a
 * post dragged three times and then published on the new date is not an
 * on-time delivery, and counting it as one would make the number useless.
 */
export function buildPerformance(
  posts: Post[],
  { from, to, calendarId }: { from: string; to: string; calendarId?: string },
): Performance {
  const inScope = posts.filter(
    (p) =>
      p.status !== "deleted" &&
      p.date >= from &&
      p.date <= to &&
      (!calendarId || p.calendarId === calendarId),
  );

  const published = inScope.filter((p) => p.status === "published");
  // A record stored before a field existed, or one that came back incomplete,
  // must not blank out the whole panel: read every list defensively.
  const moves = (p: Post) => p.rescheduleHistory?.length ?? 0;
  const decisions = (p: Post) => p.approval?.decisions ?? [];

  const onTime = published.filter((p) => moves(p) === 0);
  const rescheduled = inScope.filter((p) => moves(p) > 0);

  const reviewed = inScope.filter((p) => decisions(p).length > 0);
  const approvedFirstTime = reviewed.filter(
    (p) =>
      decisions(p).some((d) => d.round === 1 && d.result === "approved") &&
      p.approval!.round === 1,
  );

  const minutes = inScope.reduce((sum, p) => sum + totalMinutes(p.timeEntries), 0);

  return {
    published: published.length,
    onTime: onTime.length,
    onTimeRate: published.length === 0 ? null : Math.round((onTime.length / published.length) * 100),
    rescheduled: rescheduled.length,
    approvedFirstTime: approvedFirstTime.length,
    approvalRate:
      reviewed.length === 0 ? null : Math.round((approvedFirstTime.length / reviewed.length) * 100),
    minutes,
    minutesPerPost: published.length === 0 || minutes === 0 ? null : Math.round(minutes / published.length),
  };
}

// ── First steps ──────────────────────────────────────────────

export interface FirstStep {
  key: string;
  label: string;
  done: boolean;
  hint: string;
}

/**
 * The setup checklist, computed from whether the thing exists.
 *
 * It disappears once everything is done, because a permanent checklist of
 * finished work is just furniture.
 */
export function firstSteps(data: {
  clients: Client[];
  calendars: Calendar[];
  posts: Post[];
  services: Service[];
  accounts: { id: string }[];
}): FirstStep[] {
  return [
    {
      key: "cliente",
      label: "Cadastrar o primeiro cliente",
      done: data.clients.length > 0,
      hint: "Todo o resto pendura nele.",
    },
    {
      key: "post",
      label: "Programar o primeiro post",
      done: data.posts.some((p) => p.status !== "deleted"),
      hint: "É o que o cliente vai ver no link.",
    },
    {
      key: "link",
      label: "Mandar o link do calendário ao cliente",
      done: data.calendars.length > 0 && data.posts.some((p) => p.approval),
      hint: "O link já existe; enviar é um clique em Copiar.",
    },
    {
      key: "catalogo",
      label: "Montar o catálogo de serviços",
      done: data.services.length > 0,
      hint: "Sem ele, cada proposta começa do zero.",
    },
    {
      key: "conta",
      label: "Cadastrar a conta bancária",
      done: data.accounts.length > 0,
      hint: "Sem conta, o saldo não faz sentido.",
    },
  ];
}

export function setupComplete(steps: FirstStep[]): boolean {
  return steps.every((s) => s.done);
}
