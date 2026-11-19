import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AdminLayout from "../components/AdminLayout";
import AppointmentDialog from "../components/AppointmentDialog";
import BookingSettings from "../components/BookingSettings";
import MarkedDatesPanel from "../components/MarkedDatesPanel";
import { useApp } from "../store/AppProvider";
import {
  KIND_LABEL,
  buildAgenda,
  countAgenda,
  kindColor,
  type AgendaItem,
  type AgendaItemKind,
} from "../agenda";
import { formatLongDay, formatShortDay, toDayISO, todayISO } from "../utils";

type View = "mes" | "semana" | "dia" | "lista";

const VIEWS: { key: View; label: string }[] = [
  { key: "mes", label: "Mês" },
  { key: "semana", label: "Semana" },
  { key: "dia", label: "Dia" },
  { key: "lista", label: "Lista" },
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Agenda (benchmark spec 04).
 *
 * Everything on screen is a projection built on the fly from the modules
 * that own the data. Nothing here is stored twice, which is why a rebuild
 * can never disagree with what was shown before.
 */
export default function AgendaPage() {
  const navigate = useNavigate();
  const { appointments, bookings, posts, markedDates, clients, calendars } = useApp();

  const [view, setView] = useState<View>("mes");
  const [cursor, setCursor] = useState(() => new Date());
  const [editing, setEditing] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<AgendaItemKind>>(new Set());

  const range = useMemo(() => {
    if (view === "dia") return { from: toDayISO(cursor), to: toDayISO(cursor) };
    if (view === "semana") {
      return {
        from: toDayISO(startOfWeek(cursor, { weekStartsOn: 0 })),
        to: toDayISO(endOfWeek(cursor, { weekStartsOn: 0 })),
      };
    }
    if (view === "mes") {
      return {
        from: toDayISO(startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })),
        to: toDayISO(endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })),
      };
    }
    // Lista: the next 60 days, which is what "what is coming" means.
    return { from: todayISO(), to: toDayISO(addDays(new Date(), 60)) };
  }, [view, cursor]);

  const items = useMemo(
    () =>
      buildAgenda(range.from, range.to, {
        appointments,
        bookings,
        posts,
        markedDates,
      }).filter((i) => !hidden.has(i.kind)),
    [range, appointments, bookings, posts, markedDates, hidden],
  );

  const counts = useMemo(() => countAgenda(items), [items]);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const i of items) {
      const list = map.get(i.date) ?? [];
      list.push(i);
      map.set(i.date, list);
    }
    return map;
  }, [items]);

  const step = (direction: -1 | 1) => {
    if (view === "mes") setCursor((c) => addMonths(c, direction));
    else if (view === "semana") setCursor((c) => addDays(c, 7 * direction));
    else setCursor((c) => addDays(c, direction));
  };

  const openItem = (item: AgendaItem) => {
    if (item.kind === "appointment" || item.kind === "booking") {
      setEditing(item.kind === "appointment" ? item.refId : null);
      if (item.kind === "appointment") setDialogOpen(true);
      return;
    }
    if (item.kind === "post" || item.kind === "approval") {
      const post = posts.find((p) => p.id === item.refId);
      const cal = post && calendars.find((c) => c.id === post.calendarId);
      if (cal) navigate(`/app/calendars/${cal.id}`);
      return;
    }
    toast.info(item.title);
  };

  const periodLabel =
    view === "lista"
      ? "Próximos 60 dias"
      : view === "mes"
        ? cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        : view === "semana"
          ? `${formatShortDay(range.from)} – ${formatShortDay(range.to)}`
          : formatLongDay(range.from);

  const toggleKind = (kind: AgendaItemKind) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name;

  return (
    <AdminLayout section="agenda" title="Agenda">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold capitalize sm:text-2xl">
            {periodLabel}
          </h1>
          <p className="text-xs text-muted-foreground">
            {counts.total} {counts.total === 1 ? "item" : "itens"} · {counts.done}{" "}
            {counts.done === 1 ? "concluído" : "concluídos"}
            {counts.late > 0 && (
              <span className="text-destructive"> · {counts.late} atrasado(s)</span>
            )}
          </p>
        </div>
        <Button
          className="gap-1.5"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <CalendarPlus className="h-4 w-4" /> Novo compromisso
        </Button>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => step(-1)} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => step(1)} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Hoje
          </Button>
        </div>

        <div className="flex rounded-lg border border-border p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              aria-pressed={view === v.key}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === v.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Per-type counters double as filters. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(KIND_LABEL) as AgendaItemKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              aria-pressed={!hidden.has(kind)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-opacity",
                hidden.has(kind) ? "opacity-40" : "opacity-100",
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: kindColor(kind) }}
              />
              {KIND_LABEL[kind]}
              <span className="text-muted-foreground">{counts.byKind[kind]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Month grid */}
      {view === "mes" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-muted">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <span className="sm:hidden">{w.charAt(0)}</span>
                <span className="hidden sm:inline">{w}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {eachDay(range.from, range.to).map((day) => {
              const dayItems = byDay.get(day) ?? [];
              const inMonth = day.slice(0, 7) === toDayISO(cursor).slice(0, 7);
              return (
                <div
                  key={day}
                  className={cn(
                    "flex min-h-[96px] flex-col gap-1 border-b border-r border-border/60 p-1.5",
                    !inMonth && "bg-foreground/[0.03]",
                    day === todayISO() && "bg-primary/[0.06]",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      inMonth ? "text-foreground/80" : "text-muted-foreground/40",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {dayItems.slice(0, 4).map((item) => (
                    <AgendaChip key={item.id} item={item} onClick={() => openItem(item)} />
                  ))}
                  {dayItems.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{dayItems.length - 4}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Week, day and list all read as a grouped list — the difference is
           the range, not the furniture. */
        <div className="space-y-4">
          {[...byDay.entries()].length === 0 && (
            <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Nada neste período.
            </p>
          )}
          {[...byDay.entries()].map(([day, dayItems]) => (
            <div key={day} className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <h3 className="text-sm font-semibold capitalize">{formatLongDay(day)}</h3>
                {day === todayISO() && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                    hoje
                  </span>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {dayItems.length} {dayItems.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {dayItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-foreground/[0.03]"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {item.time ? `${item.time}${item.endTime ? `–${item.endTime}` : ""}` : "dia todo"}
                      </span>
                      <span
                        className={cn(
                          "flex-1 truncate text-sm",
                          item.done && "text-muted-foreground line-through",
                        )}
                      >
                        {item.title}
                      </span>
                      {item.clientId && (
                        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
                          {clientName(item.clientId)}
                        </span>
                      )}
                      {item.done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                      {item.late && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                      <span className="hidden shrink-0 rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
                        {KIND_LABEL[item.kind]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <MarkedDatesPanel month={toDayISO(cursor).slice(0, 7)} />
        <BookingSettings />
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appointmentId={editing}
        defaultDay={view === "dia" ? range.from : undefined}
      />
    </AdminLayout>
  );
}

function AgendaChip({ item, onClick }: { item: AgendaItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${KIND_LABEL[item.kind]}${item.detail ? ` · ${item.detail}` : ""}`}
      className={cn(
        "flex items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] leading-tight transition-colors hover:brightness-110",
        item.done && "opacity-60",
      )}
      style={{ backgroundColor: `${item.color}22`, borderLeft: `2px solid ${item.color}` }}
    >
      {item.time && <span className="shrink-0 tabular-nums opacity-70">{item.time}</span>}
      <span className={cn("truncate", item.done && "line-through")}>{item.title}</span>
    </button>
  );
}

/** Every day between two ISO days, inclusive. */
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cur <= end) {
    out.push(toDayISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
