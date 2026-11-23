import { useMemo, useState } from "react";
import { addMonths as addMonthsDate, startOfMonth } from "date-fns";
import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Link2,
  Plus,
  Repeat,
  RotateCcw,
  Tags,
  Undo2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import AdminLayout from "../components/AdminLayout";
import AiDialog from "../components/AiDialog";
import { contextFinanceiro } from "../ai";
import ReconcilePanel from "../components/ReconcilePanel";
import EntryDialog from "../components/EntryDialog";
import AccountDialog from "../components/AccountDialog";
import EmptyState from "../components/EmptyState";
import { useApp } from "../store/AppProvider";
import { formatMoney } from "../money";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  accountBalance,
  forecastMonthEnd,
  overdue,
  pendingProjections,
  resultByCash,
  resultByCompetence,
  totalBalance,
  upcoming,
} from "../finance";
import type { FinanceEntry } from "../types";
import { formatShortDay, toDayISO, todayISO, uid } from "../utils";

/**
 * Finance (benchmark spec 08).
 *
 * The month's list mixes real rows with *projections* from recurring series.
 * A projection has no row behind it and says so; it becomes one when it comes
 * inside the window or when someone acts on it. Keeping the two visibly
 * different is the point: a forecast you cannot tell from a fact is how a
 * cash position quietly becomes fiction.
 */
export default function FinancePage() {
  const {
    accounts,
    categories,
    entries,
    series,
    transfers,
    clients,
    settleEntry,
    unsettleEntry,
    reverseEntry,
    saveEntry,
    materialiseSeries,
  } = useApp();

  const [tab, setTab] = useState("visao");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [editing, setEditing] = useState<FinanceEntry | null | undefined>();
  const [accountOpen, setAccountOpen] = useState(false);

  const month = toDayISO(cursor).slice(0, 7);
  const today = todayISO();

  const projections = useMemo(
    () => pendingProjections(series, entries, `${month}-01`, `${month}-31`),
    [series, entries, month],
  );

  const monthEntries = useMemo(
    () =>
      [...entries.filter((e) => e.competence === month), ...projections].sort((a, b) =>
        a.dueDate.localeCompare(b.dueDate),
      ),
    [entries, projections, month],
  );

  /** Expected includes projections; realised counts only what settled. */
  const expected = useMemo(
    () => resultByCompetence([...entries, ...projections], month),
    [entries, projections, month],
  );
  const realised = useMemo(() => resultByCash(entries, month), [entries, month]);
  const balance = useMemo(
    () => totalBalance(accounts, entries, transfers, today),
    [accounts, entries, transfers, today],
  );
  const forecast = useMemo(
    () => forecastMonthEnd(accounts, [...entries, ...projections], transfers, month, today),
    [accounts, entries, projections, transfers, month, today],
  );
  const late = useMemo(() => overdue(entries, today), [entries, today]);
  const next = useMemo(() => upcoming(entries, 15, today), [entries, today]);

  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name;
  const categoryName = (id?: string) => categories.find((c) => c.id === id)?.name;
  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name;

  const quickSettle = async (entry: FinanceEntry) => {
    const account = accounts.find((a) => a.id === entry.accountId) ?? accounts[0];
    if (!account) return toast.error("Cadastre uma conta antes de liquidar.");
    try {
      // A projection has no row behind it. Paying one is the moment it becomes
      // real, so the row is created and settled in the same gesture — asking
      // the user to click twice would be an implementation detail leaking out.
      const id = entries.some((e) => e.id === entry.id)
        ? entry.id
        : (await saveEntry({ ...entry, id: uid("fin"), status: "pendente" })).id;
      await settleEntry(id, account.id, today);
      toast.success(`${entry.description} liquidado em ${account.name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível liquidar.");
    }
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir.");
    }
  };

  return (
    <AdminLayout section="financeiro" title="Financeiro">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Financeiro</h1>
          <p className="text-xs text-muted-foreground">
            Saldo hoje {formatMoney(balance)}
            {late.length > 0 && (
              <span className="text-destructive"> · {late.length} em atraso</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AiDialog
            action="explicar_financeiro"
            size="default"
            context={() =>
              contextFinanceiro({
                month,
                entries: monthEntries,
                categoryName: (id) => categoryName(id) ?? "Sem categoria",
              })
            }
          />
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              act(async () => {
                const n = await materialiseSeries();
                if (n === 0) throw new Error("Nada a materializar nesta janela.");
              }, "Previsões viraram lançamentos.")
            }
          >
            <Repeat className="h-4 w-4" /> Materializar
          </Button>
          <Button className="gap-1.5" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Novo lançamento
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="visao" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Visão geral
          </TabsTrigger>
          <TabsTrigger value="lancamentos" className="gap-1.5">
            <Tags className="h-3.5 w-3.5" /> Lançamentos
          </TabsTrigger>
          <TabsTrigger value="conciliacao" className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Conciliação
          </TabsTrigger>
          <TabsTrigger value="contas" className="gap-1.5">
            <Landmark className="h-3.5 w-3.5" /> Contas
            <span className="text-muted-foreground">{accounts.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Conciliação de extrato (ficha 13, F13b) ── */}
        <TabsContent value="conciliacao" className="mt-4">
          <ReconcilePanel />
        </TabsContent>

        {/* ── Visão geral ── */}
        <TabsContent value="visao" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Saldo hoje" value={formatMoney(balance)} />
            <Card
              label="Resultado do mês (previsto)"
              value={formatMoney(expected.result)}
              tone={expected.result >= 0 ? "good" : "bad"}
              hint={`${formatMoney(expected.revenue)} entra · ${formatMoney(expected.expense)} sai`}
            />
            <Card
              label="Resultado do mês (realizado)"
              value={formatMoney(realised.result)}
              tone={realised.result >= 0 ? "good" : "bad"}
              hint="só o que já foi liquidado"
            />
            <Card
              label="Previsão de fechamento"
              value={formatMoney(forecast)}
              tone={forecast >= 0 ? "good" : "bad"}
              hint="saldo + o que ainda vence no mês"
            />
          </div>

          {late.length > 0 && (
            <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Em atraso
              </p>
              <ul className="space-y-1">
                {late.slice(0, 6).map((e) => (
                  <EntryLine
                    key={e.id}
                    entry={e}
                    onSettle={() => quickSettle(e)}
                    onOpen={() => setEditing(e)}
                    accountName={accountName}
                    categoryName={categoryName}
                    clientName={clientName}
                  />
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Próximos 15 dias
            </p>
            {next.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Nada vencendo por aqui.
              </p>
            ) : (
              <ul className="space-y-1">
                {next.map((e) => (
                  <EntryLine
                    key={e.id}
                    entry={e}
                    onSettle={() => quickSettle(e)}
                    onOpen={() => setEditing(e)}
                    accountName={accountName}
                    categoryName={categoryName}
                    clientName={clientName}
                  />
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* ── Lançamentos ── */}
        <TabsContent value="lancamentos" className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="Mês anterior"
              onClick={() => setCursor((c) => addMonthsDate(c, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="Próximo mês"
              onClick={() => setCursor((c) => addMonthsDate(c, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="font-display text-lg font-semibold capitalize">
              {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatMoney(expected.revenue)} entra · {formatMoney(expected.expense)} sai ·{" "}
              <strong className={expected.result >= 0 ? "text-emerald-500" : "text-destructive"}>
                {formatMoney(expected.result)}
              </strong>
            </span>
          </div>

          {monthEntries.length === 0 ? (
            <EmptyState
              icon={<Tags className="h-10 w-10" />}
              title="Nada neste mês"
              description="Lance uma receita ou despesa, ou crie uma série recorrente."
              action={<Button onClick={() => setEditing(null)}>Novo lançamento</Button>}
            />
          ) : (
            <ul className="space-y-1">
              {monthEntries.map((e) => {
                const isProjection = !entries.some((x) => x.id === e.id);
                return (
                  <EntryLine
                    key={e.id}
                    entry={e}
                    projection={isProjection}
                    onSettle={() => quickSettle(e)}
                    onOpen={() => !isProjection && setEditing(e)}
                    onUnsettle={
                      e.status === "liquidado"
                        ? () => act(() => unsettleEntry(e.id), "Baixa desfeita.")
                        : undefined
                    }
                    onReverse={
                      e.status === "liquidado"
                        ? () => act(() => reverseEntry(e.id), "Estorno lançado.")
                        : undefined
                    }
                    onCancel={
                      e.status === "pendente" && !isProjection
                        ? () =>
                            act(
                              () => saveEntry({ ...e, status: "cancelado" }),
                              "Lançamento cancelado.",
                            )
                        : undefined
                    }
                    accountName={accountName}
                    categoryName={categoryName}
                    clientName={clientName}
                  />
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ── Contas ── */}
        <TabsContent value="contas" className="mt-4 space-y-3">
          <Button variant="outline" className="gap-1.5" onClick={() => setAccountOpen(true)}>
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
          {accounts.length === 0 ? (
            <EmptyState
              icon={<Landmark className="h-10 w-10" />}
              title="Nenhuma conta"
              description="Cadastre onde o dinheiro entra e sai para que o saldo faça sentido."
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((a) => (
                <li
                  key={a.id}
                  className={cn(
                    "rounded-xl border border-border bg-card p-3",
                    !a.active && "opacity-60",
                  )}
                >
                  <p className="text-xs text-muted-foreground">{a.name}</p>
                  <p className="text-xl font-semibold">
                    {formatMoney(accountBalance(a, entries, transfers, today))}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.kind} · desde {formatShortDay(a.initialBalanceDate)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {transfers.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Transferências
              </p>
              <ul className="space-y-1 text-xs">
                {transfers.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span className="text-muted-foreground">{formatShortDay(t.date)}</span>
                    <span>
                      {accountName(t.fromAccountId)} → {accountName(t.toAccountId)}
                    </span>
                    <span className="ml-auto font-medium">{formatMoney(t.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Transferências movem valor entre contas e ficam fora do resultado.
              </p>
            </section>
          )}
        </TabsContent>
      </Tabs>

      <EntryDialog
        open={editing !== undefined}
        entry={editing ?? null}
        defaultMonth={month}
        onOpenChange={(v) => !v && setEditing(undefined)}
      />
      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </AdminLayout>
  );
}

function Card({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EntryLine({
  entry,
  projection,
  onSettle,
  onOpen,
  onUnsettle,
  onReverse,
  onCancel,
  accountName,
  categoryName,
  clientName,
}: {
  entry: FinanceEntry;
  projection?: boolean;
  onSettle: () => void;
  onOpen: () => void;
  onUnsettle?: () => void;
  onReverse?: () => void;
  onCancel?: () => void;
  accountName: (id?: string) => string | undefined;
  categoryName: (id?: string) => string | undefined;
  clientName: (id?: string) => string | undefined;
}) {
  const income = entry.nature === "receita";
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_COLOR[entry.status] }}
        title={STATUS_LABEL[entry.status]}
      />
      <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
        {formatShortDay(entry.dueDate)}
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={cn("truncate text-sm", entry.status === "cancelado" && "line-through opacity-60")}>
          {entry.description}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {[categoryName(entry.categoryId), clientName(entry.clientId), accountName(entry.accountId)]
            .filter(Boolean)
            .join(" · ")}
          {entry.seriesPosition ? ` · parcela ${entry.seriesPosition}` : ""}
        </p>
      </button>
      {projection && (
        <span
          className="shrink-0 rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
          title="Previsão de uma série; ainda não é um lançamento"
        >
          previsto
        </span>
      )}
      <span
        className={cn(
          "shrink-0 text-sm font-medium tabular-nums",
          income ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
        )}
      >
        {income ? "+" : "−"}
        {formatMoney(entry.amount, false)}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        {entry.status !== "liquidado" && entry.status !== "cancelado" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-emerald-600 dark:text-emerald-400"
            title="Liquidar"
            onClick={onSettle}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        {onUnsettle && (
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Desfazer baixa" onClick={onUnsettle}>
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {onReverse && (
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Estornar" onClick={onReverse}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        {onCancel && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Cancelar"
            onClick={onCancel}
          >
            <Ban className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}
