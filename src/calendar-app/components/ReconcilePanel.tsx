import { useMemo, useRef, useState } from "react";
import { Check, FileUp, Link2, Link2Off, Plus, SlashSquare, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import EmptyState from "./EmptyState";
import { useApp } from "../store/AppProvider";
import {
  LINE_STATUS_LABEL,
  autoMatch,
  buildImport,
  entryFromLine,
  ignoreLine,
  parseStatement,
  reconcile,
  suggestMatches,
  summarise,
  undoReconcile,
  unignoreLine,
} from "../statement";
import { formatMoney } from "../money";
import type { StatementLine, StatementLineStatus } from "../types";
import { formatShortDay } from "../utils";

/**
 * Conciliação de extrato (benchmark ficha 13, F13b).
 *
 * The screen suggests and the person decides — that is the ficha's rule and
 * the reason there is no "reconcile everything" button. What it does offer
 * is "apply the certain ones": matches where exactly one entry has the same
 * value on the same day. Two entries of the same value never auto-match.
 */
export default function ReconcilePanel() {
  const {
    accounts,
    entries,
    statementLines,
    saveStatementLines,
    deleteStatementLine,
    saveEntry,
  } = useApp();

  const fileRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [filter, setFilter] = useState<StatementLineStatus | "todas">("a_conferir");
  const [busy, setBusy] = useState(false);

  const ofAccount = useMemo(
    () =>
      statementLines
        .filter((l) => l.accountId === accountId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [statementLines, accountId],
  );
  const visible = useMemo(
    () => (filter === "todas" ? ofAccount : ofAccount.filter((l) => l.status === filter)),
    [ofAccount, filter],
  );
  const stats = summarise(ofAccount);

  // Only entries nobody has matched yet are offered, so two lines cannot
  // settle the same invoice.
  const taken = useMemo(
    () => new Set(statementLines.map((l) => l.entryId).filter(Boolean) as string[]),
    [statementLines],
  );
  const openEntries = useMemo(() => entries.filter((e) => !taken.has(e.id)), [entries, taken]);

  async function importFile(file: File) {
    if (!accountId) return toast.error("Escolha a conta do extrato.");
    setBusy(true);
    try {
      const parsed = parseStatement(await file.text());
      const result = buildImport(accountId, parsed, statementLines);
      if (result.fresh.length > 0) await saveStatementLines(result.fresh);
      const parts = [`${result.fresh.length} linha(s) importada(s)`];
      if (result.duplicates > 0) parts.push(`${result.duplicates} já estavam aqui`);
      if (result.errors.length > 0) parts.push(`${result.errors.length} ilegível(is)`);
      toast.success(parts.join(" · "));
      if (result.errors.length > 0) toast.error(result.errors.slice(0, 3).join("\n"));
    } catch {
      toast.error("Não deu para ler o arquivo.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function applyCertain() {
    const pending = ofAccount.filter((l) => l.status === "a_conferir");
    const used = new Set<string>();
    const lines: StatementLine[] = [];
    for (const line of pending) {
      const match = autoMatch(
        suggestMatches(line, openEntries.filter((e) => !used.has(e.id))),
      );
      if (!match) continue;
      const out = reconcile(line, match.entry);
      used.add(match.entry.id);
      lines.push(out.line);
      await saveEntry(out.entry);
    }
    if (lines.length === 0) {
      toast("Nenhuma certeza para aplicar. As demais ficam para você escolher.");
      return;
    }
    await saveStatementLines(lines);
    toast.success(`${lines.length} linha(s) conciliada(s).`);
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<Link2 className="h-8 w-8" />}
        title="Cadastre uma conta primeiro"
        description="O extrato é de uma conta. Sem conta, não há onde conciliar."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="rc-account" className="text-[11px]">
            Conta
          </Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id="rc-account" className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.ofx,.txt,text/csv,text/plain"
          className="hidden"
          aria-label="Arquivo do extrato"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <FileUp className="h-3.5 w-3.5" /> Importar extrato
        </Button>
        {stats.pending > 0 && (
          <Button variant="outline" className="gap-1.5" onClick={() => void applyCertain()}>
            <Check className="h-3.5 w-3.5" /> Aplicar as certas
          </Button>
        )}
        <div className="flex gap-1">
          {(["a_conferir", "conferida", "ignorada", "todas"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                filter === s
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "todas" ? "Todas" : LINE_STATUS_LABEL[s]}{" "}
              <span className="tabular-nums opacity-60">
                {s === "todas"
                  ? stats.total
                  : s === "a_conferir"
                    ? stats.pending
                    : s === "conferida"
                      ? stats.reconciled
                      : stats.ignored}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        CSV ou OFX do banco. O arquivo é lido aqui no navegador e nada dele vai para fora.
        Importar o mesmo arquivo de novo não duplica nada: a linha é reconhecida pelo id do banco,
        ou por data, valor e histórico.
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={<FileUp className="h-8 w-8" />}
          title={stats.total === 0 ? "Nenhum extrato importado" : "Nada nesta situação"}
          description={
            stats.total === 0
              ? "Importe o CSV ou OFX da conta para conferir o que o banco registrou contra o que está lançado aqui."
              : "Troque o filtro para ver as outras linhas."
          }
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((line) => (
            <LineRow
              key={line.id}
              line={line}
              entries={openEntries}
              onReconcile={async (entryId) => {
                const entry = entries.find((e) => e.id === entryId);
                if (!entry) return;
                const out = reconcile(line, entry);
                await saveEntry(out.entry);
                await saveStatementLines([out.line]);
                toast.success("Linha conciliada.");
              }}
              onUndo={async () => {
                const entry = entries.find((e) => e.id === line.entryId);
                const out = undoReconcile(line, entry);
                if (out.entry) await saveEntry(out.entry);
                await saveStatementLines([out.line]);
                toast.success(
                  out.entry
                    ? "Conciliação desfeita e baixa revertida."
                    : "Conciliação desfeita. A baixa feita à mão ficou como estava.",
                );
              }}
              onIgnore={async () => {
                await saveStatementLines([ignoreLine(line)]);
                toast.success("Linha ignorada.");
              }}
              onUnignore={async () => {
                await saveStatementLines([unignoreLine(line)]);
              }}
              onCreate={async () => {
                const created = entryFromLine(line);
                await saveEntry(created);
                await saveStatementLines([reconcile(line, created).line]);
                toast.success("Lançamento criado a partir do extrato, já liquidado.");
              }}
              onDelete={async () => {
                await deleteStatementLine(line.id);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LineRow({
  line,
  entries,
  onReconcile,
  onUndo,
  onIgnore,
  onUnignore,
  onCreate,
  onDelete,
}: {
  line: StatementLine;
  entries: import("../types").FinanceEntry[];
  onReconcile: (entryId: string) => Promise<void>;
  onUndo: () => Promise<void>;
  onIgnore: () => Promise<void>;
  onUnignore: () => Promise<void>;
  onCreate: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const suggestions = useMemo(
    () => (line.status === "a_conferir" ? suggestMatches(line, entries).slice(0, 4) : []),
    [line, entries],
  );
  const incoming = line.amount > 0;

  return (
    <li
      className={cn(
        "rounded-xl border border-border bg-card p-3",
        line.status === "ignorada" && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 shrink-0 text-[11px] text-muted-foreground">
          {formatShortDay(line.date)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {line.description || "(sem histórico)"}
        </span>
        <span
          className={cn(
            "shrink-0 text-sm tabular-nums",
            incoming ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
          )}
        >
          {incoming ? "+" : "−"}
          {formatMoney(Math.abs(line.amount), false)}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {LINE_STATUS_LABEL[line.status]}
        </span>
      </div>

      {line.status === "a_conferir" && (
        <div className="mt-2 space-y-1.5">
          {suggestions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Nenhum lançamento deste valor em aberto.
            </p>
          ) : (
            <>
              {suggestions.length > 1 && (
                <p className="text-[11px] text-amber-600">
                  {suggestions.length} lançamentos com o mesmo valor — escolha qual é.
                </p>
              )}
              {suggestions.map((s) => (
                <div
                  key={s.entry.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-foreground/[0.03] p-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {s.entry.description}
                    <span className="text-muted-foreground">
                      {" "}
                      · vence {formatShortDay(s.entry.dueDate)} · {s.reason}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {s.confidence}%
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[11px]"
                    onClick={() => void onReconcile(s.entry.id)}
                  >
                    <Link2 className="h-3.5 w-3.5" /> conciliar
                  </Button>
                </div>
              ))}
            </>
          )}
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void onCreate()}>
              <Plus className="h-3.5 w-3.5" /> criar lançamento
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void onIgnore()}>
              <SlashSquare className="h-3.5 w-3.5" /> ignorar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void onDelete()}>
              apagar linha
            </Button>
          </div>
        </div>
      )}

      {line.status === "conferida" && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {line.settledEntry
              ? "Baixa dada por esta conciliação, na data do banco."
              : "Ligada a um lançamento que já estava liquidado."}
          </span>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void onUndo()}>
            <Link2Off className="h-3.5 w-3.5" /> desfazer
          </Button>
        </div>
      )}

      {line.status === "ignorada" && (
        <Button size="sm" variant="ghost" className="mt-1 h-7 gap-1 px-2 text-[11px]" onClick={() => void onUnignore()}>
          <Undo2 className="h-3.5 w-3.5" /> trazer de volta
        </Button>
      )}
    </li>
  );
}
