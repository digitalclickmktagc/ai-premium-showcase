import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileSignature,
  FileText,
  ListChecks,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import AdminLayout from "../components/AdminLayout";
import AiDialog from "../components/AiDialog";
import { useApp } from "../store/AppProvider";
import {
  buildDayWork,
  buildPerformance,
  buildTimesheet,
  countWork,
  firstSteps,
  setupComplete,
} from "../daily";
import { contextResumoDoDia } from "../ai";
import { KIND_LABEL } from "../agenda";
import { formatDuration } from "../cards";
import { formatMoney } from "../money";
import { formatLongDay, formatShortDay, toDayISO, todayISO } from "../utils";

const ALL = "__all__";
const DAY_MS = 86400000;

/**
 * Compact label for the row's left column. "hoje" / "ontem" / "amanhã" say
 * more than a weekday and, unlike one, they fit on a phone without wrapping.
 */
function dayLabel(day: string, today: string): string {
  const diff = Math.round(
    (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY_MS,
  );
  if (diff === 0) return "hoje";
  if (diff === -1) return "ontem";
  if (diff === 1) return "amanhã";
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/**
 * The day's panel (benchmark ficha 19).
 *
 * Every number is computed from the module that owns the data, on render.
 * There is no "today" table: a counter that can disagree with the thing it
 * counts is worse than no counter.
 */
export default function TodayPage() {
  const navigate = useNavigate();
  const {
    posts,
    appointments,
    bookings,
    markedDates,
    crmTasks,
    deals,
    entries,
    proposals,
    contracts,
    clients,
    calendars,
    services,
    accounts,
    saveCrmTask,
  } = useApp();

  const today = todayISO();
  const [tab, setTab] = useState("hoje");
  const [period, setPeriod] = useState<"mes" | "mes_passado">("mes");
  const [calendarId, setCalendarId] = useState(ALL);

  const work = useMemo(
    () =>
      buildDayWork({
        posts,
        appointments,
        bookings,
        markedDates,
        crmTasks,
        deals,
        entries,
        proposals,
        contracts,
        today,
      }),
    [posts, appointments, bookings, markedDates, crmTasks, deals, entries, proposals, contracts, today],
  );

  const range = useMemo(() => {
    const base = period === "mes" ? new Date() : subMonths(new Date(), 1);
    return { from: toDayISO(startOfMonth(base)), to: toDayISO(endOfMonth(base)) };
  }, [period]);

  const scope = calendarId === ALL ? undefined : calendarId;
  const sheet = useMemo(
    () => buildTimesheet(posts, { ...range, calendarId: scope }),
    [posts, range, scope],
  );
  const perf = useMemo(
    () => buildPerformance(posts, { ...range, calendarId: scope }),
    [posts, range, scope],
  );

  const steps = useMemo(
    () => firstSteps({ clients, calendars, posts, services, accounts }),
    [clients, calendars, posts, services, accounts],
  );
  const showSteps = !setupComplete(steps);

  const total = countWork(work);
  const clientOf = (calId: string) => {
    const cal = calendars.find((c) => c.id === calId);
    return clients.find((c) => c.id === cal?.clientId)?.name ?? "—";
  };
  const openCalendar = (calId: string) => navigate(`/app/calendars/${calId}`);

  return (
    <AdminLayout section="hoje" title="Hoje">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold first-letter:uppercase sm:text-2xl">
            {formatLongDay(today)}
          </h1>
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? "Nada pedindo atenção agora."
              : `${total} ${total === 1 ? "coisa pedindo atenção" : "coisas pedindo atenção"}`}
          </p>
        </div>
        <AiDialog
          action="resumo_do_dia"
          context={() =>
            contextResumoDoDia({
              today,
              late: work.latePosts,
              waiting: work.waitingClient,
              dueToday: work.financeDue.map((e) => ({
                description: e.description,
                amount: e.amount,
                nature: e.nature,
              })),
              overdue: work.financeOverdue.map((e) => ({
                description: e.description,
                amount: e.amount,
                nature: e.nature,
              })),
              tasks: work.crmTasks.map((t) => ({ title: t.title, dueOn: t.dueOn })),
              clientOf,
            })
          }
        />
      </div>

      {showSteps && (
        <section className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Primeiros passos
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.key} className="flex items-start gap-2 text-sm">
                <CheckCircle2
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    s.done ? "text-emerald-500" : "text-muted-foreground/40",
                  )}
                />
                <span className={cn(s.done && "text-muted-foreground line-through")}>
                  {s.label}
                  {!s.done && (
                    <span className="block text-[11px] text-muted-foreground">{s.hint}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="hoje" className="gap-1.5">
            <ListChecks className="h-3.5 w-3.5" /> O dia
            {total > 0 && <span className="text-muted-foreground">{total}</span>}
          </TabsTrigger>
          <TabsTrigger value="horas" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Horas
          </TabsTrigger>
          <TabsTrigger value="desempenho" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Desempenho
          </TabsTrigger>
        </TabsList>

        {/* ── O dia ── */}
        <TabsContent value="hoje" className="mt-4 grid items-start gap-3 lg:grid-cols-2">
          <Panel
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            title="Na agenda de hoje"
            count={work.agenda.length}
            empty="Dia livre."
          >
            {work.agenda.map((item) => (
              <Row
                key={item.id}
                left={item.time ?? "dia todo"}
                title={item.title}
                hint={KIND_LABEL[item.kind]}
                done={item.done}
                onClick={() => navigate("/app/agenda")}
              />
            ))}
          </Panel>

          <Panel
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            title="Posts atrasados"
            count={work.latePosts.length}
            tone={work.latePosts.length > 0 ? "warn" : undefined}
            empty="Nenhum post atrasado."
          >
            {work.latePosts.slice(0, 8).map((p) => (
              <Row
                key={p.id}
                left={dayLabel(p.date, today)}
                title={p.title}
                hint={clientOf(p.calendarId)}
                onClick={() => openCalendar(p.calendarId)}
              />
            ))}
          </Panel>

          <Panel
            icon={<FileText className="h-3.5 w-3.5" />}
            title="Na mão do cliente"
            count={work.waitingClient.length}
            empty="Nada aguardando resposta."
          >
            {work.waitingClient.slice(0, 8).map((p) => (
              <Row
                key={p.id}
                left={dayLabel(p.date, today)}
                title={p.title}
                hint={clientOf(p.calendarId)}
                onClick={() => openCalendar(p.calendarId)}
              />
            ))}
          </Panel>

          <Panel
            icon={<Target className="h-3.5 w-3.5" />}
            title="Comercial"
            count={work.crmTasks.length + work.dealsNoNextStep.length + work.proposalsExpiring.length}
            empty="Nada cobrando você no comercial."
          >
            {work.crmTasks.map((t) => (
              <Row
                key={t.id}
                left={dayLabel(t.dueOn, today)}
                title={t.title}
                hint={deals.find((d) => d.id === t.dealId)?.name}
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => void saveCrmTask({ ...t, doneAt: new Date().toISOString() })}
                  >
                    concluir
                  </Button>
                }
                onClick={() => navigate("/app/crm")}
              />
            ))}
            {work.dealsNoNextStep.slice(0, 5).map((d) => (
              <Row
                key={d.id}
                left="sem passo"
                title={d.name}
                hint="nenhuma tarefa marcada"
                onClick={() => navigate("/app/crm")}
              />
            ))}
            {work.proposalsExpiring.map((p) => (
              <Row
                key={p.id}
                left={dayLabel(p.validUntil, today)}
                title={p.title}
                hint="proposta vencendo"
                onClick={() => navigate("/app/comercial")}
              />
            ))}
          </Panel>

          <Panel
            icon={<Wallet className="h-3.5 w-3.5" />}
            title="Dinheiro"
            count={work.financeOverdue.length + work.financeDue.length}
            tone={work.financeOverdue.length > 0 ? "warn" : undefined}
            empty="Nada vencendo hoje."
          >
            {[...work.financeOverdue, ...work.financeDue].slice(0, 8).map((e) => (
              <Row
                key={e.id}
                left={dayLabel(e.dueDate, today)}
                title={e.description}
                hint={`${e.nature === "receita" ? "+" : "−"}${formatMoney(e.amount, false)}`}
                tone={e.dueDate < today ? "warn" : undefined}
                onClick={() => navigate("/app/financeiro")}
              />
            ))}
          </Panel>

          {work.contractsToSign.length > 0 && (
            <Panel
              icon={<FileSignature className="h-3.5 w-3.5" />}
              title="Esperando a sua assinatura"
              count={work.contractsToSign.length}
              tone="warn"
              empty=""
            >
              {work.contractsToSign.map((c) => (
                <Row
                  key={c.id}
                  left="assinar"
                  title={c.title}
                  hint="o cliente já assinou"
                  onClick={() => navigate("/app/comercial")}
                />
              ))}
            </Panel>
          )}
        </TabsContent>

        {/* ── Horas ── */}
        <TabsContent value="horas" className="mt-4 space-y-3">
          <Filters
            period={period}
            setPeriod={setPeriod}
            calendarId={calendarId}
            setCalendarId={setCalendarId}
            calendars={calendars}
            clientOf={clientOf}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Figure label="Total lançado" value={formatDuration(sheet.totalMinutes)} />
            <Figure
              label="Dias com lançamento"
              value={String(sheet.byDay.length)}
              hint={`${sheet.rows.length} apontamento(s)`}
            />
            <Figure
              label="Média por dia"
              value={
                sheet.byDay.length
                  ? formatDuration(Math.round(sheet.totalMinutes / sheet.byDay.length))
                  : "—"
              }
            />
          </div>

          {sheet.byCalendar.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Por cliente
              </p>
              <ul className="space-y-1.5">
                {sheet.byCalendar.map((row) => {
                  const share = Math.round((row.minutes / sheet.totalMinutes) * 100);
                  return (
                    <li key={row.calendarId} className="flex items-center gap-2 text-sm">
                      <span className="w-40 shrink-0 truncate">{clientOf(row.calendarId)}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right tabular-nums">
                        {formatDuration(row.minutes)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Apontamentos
            </p>
            {sheet.rows.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Nenhuma hora lançada neste período. As horas vêm da aba Tempo de cada card.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {sheet.rows.map((r, i) => (
                  <li key={`${r.postId}-${i}`} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
                      {formatShortDay(r.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{r.postTitle}</span>
                    {r.note && (
                      <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
                        {r.note}
                      </span>
                    )}
                    <span className="w-16 shrink-0 text-right tabular-nums">
                      {formatDuration(r.minutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* ── Desempenho ── */}
        <TabsContent value="desempenho" className="mt-4 space-y-3">
          <Filters
            period={period}
            setPeriod={setPeriod}
            calendarId={calendarId}
            setCalendarId={setCalendarId}
            calendars={calendars}
            clientOf={clientOf}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Publicados" value={String(perf.published)} />
            <Figure
              label="No prazo"
              value={perf.onTimeRate === null ? "—" : `${perf.onTimeRate}%`}
              hint={`${perf.onTime} de ${perf.published} sem reagendar`}
            />
            <Figure
              label="Aprovados de primeira"
              value={perf.approvalRate === null ? "—" : `${perf.approvalRate}%`}
              hint={`${perf.approvedFirstTime} na rodada 1`}
            />
            <Figure
              label="Tempo por post"
              value={perf.minutesPerPost === null ? "—" : formatDuration(perf.minutesPerPost)}
              hint={`${formatDuration(perf.minutes)} no período`}
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            “No prazo” conta o post publicado sem nunca ter sido movido. Um post arrastado três
            vezes e publicado na data nova não é entrega no prazo, e contar assim deixaria o
            número inútil. {perf.rescheduled > 0 && `${perf.rescheduled} post(s) reagendado(s) no período.`}
          </p>

          <section className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              Programa de recompensas e cronômetro não foram construídos. A própria ficha do
              benchmark critica pagar por tarefa concluída — incentiva fragmentar tarefa — e o
              tempo já é lançado direto no card, que é onde o trabalho acontece.
            </p>
          </section>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function Filters({
  period,
  setPeriod,
  calendarId,
  setCalendarId,
  calendars,
  clientOf,
}: {
  period: "mes" | "mes_passado";
  setPeriod: (p: "mes" | "mes_passado") => void;
  calendarId: string;
  setCalendarId: (id: string) => void;
  calendars: { id: string }[];
  clientOf: (id: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={period} onValueChange={(v) => setPeriod(v as "mes" | "mes_passado")}>
        <SelectTrigger className="h-9 w-[160px]" aria-label="Período">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mes">Este mês</SelectItem>
          <SelectItem value="mes_passado">Mês passado</SelectItem>
        </SelectContent>
      </Select>
      <Select value={calendarId} onValueChange={setCalendarId}>
        <SelectTrigger className="h-9 w-[200px]" aria-label="Cliente">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos os clientes</SelectItem>
          {calendars.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {clientOf(c.id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({
  icon,
  title,
  count,
  tone,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  tone?: "warn";
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-3",
        tone === "warn" && "border-amber-500/40",
      )}
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
        {count > 0 && (
          <span className="rounded-full bg-foreground/[0.06] px-1.5 text-[10px]">{count}</span>
        )}
      </p>
      {count === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground/70">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
    </section>
  );
}

function Row({
  left,
  title,
  hint,
  done,
  tone,
  action,
  onClick,
}: {
  left: string;
  title: string;
  hint?: string;
  done?: boolean;
  tone?: "warn";
  action?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 rounded py-1.5 text-left transition-colors hover:bg-foreground/[0.03]"
      >
        <span
          className={cn(
            "w-16 shrink-0 text-[11px] tabular-nums",
            tone === "warn" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {left}
        </span>
        <span className={cn("min-w-0 flex-1 truncate text-sm", done && "line-through opacity-60")}>
          {title}
        </span>
        {hint && (
          <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{hint}</span>
        )}
      </button>
      {action}
    </li>
  );
}
