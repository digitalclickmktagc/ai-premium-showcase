import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EntryNature, FinanceEntry, SeriesKind } from "../types";
import { canEditAmount, monthOf, validateEntry } from "../finance";
import { formatMoney, parseMoney } from "../money";
import { todayISO, uid } from "../utils";
import { useApp } from "../store/AppProvider";

const NONE = "__none__";

/**
 * One entry, or a whole series.
 *
 * A recurring series is created here but never materialises its future: the
 * charges are projected and only become rows when they come due.
 */
export default function EntryDialog({
  open,
  entry,
  defaultMonth,
  onOpenChange,
}: {
  open: boolean;
  entry: FinanceEntry | null;
  defaultMonth?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { accounts, categories, clients, saveEntry, deleteEntry, saveSeries } = useApp();
  const isEdit = Boolean(entry);
  const settled = entry?.status === "liquidado";

  const [nature, setNature] = useState<EntryNature>("despesa");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [accountId, setAccountId] = useState(NONE);
  const [categoryId, setCategoryId] = useState(NONE);
  const [clientId, setClientId] = useState(NONE);
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState<"nao" | SeriesKind>("nao");
  const [count, setCount] = useState("12");
  const [everyMonths, setEveryMonths] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNature(entry?.nature ?? "despesa");
    setDescription(entry?.description ?? "");
    setAmount(entry ? formatMoney(entry.amount, false) : "");
    setDueDate(entry?.dueDate ?? (defaultMonth ? `${defaultMonth}-05` : todayISO()));
    setAccountId(entry?.accountId ?? NONE);
    setCategoryId(entry?.categoryId ?? NONE);
    setClientId(entry?.clientId ?? NONE);
    setNote(entry?.note ?? "");
    setRepeat("nao");
    setCount("12");
    setEveryMonths("1");
  }, [open, entry, defaultMonth]);

  const save = async () => {
    const cents = parseMoney(amount);
    if (cents === null) return toast.error("Informe um valor válido.");

    setBusy(true);
    try {
      if (!isEdit && repeat !== "nao") {
        await saveSeries({
          id: uid("ser"),
          kind: repeat,
          everyMonths: Number(everyMonths) || 1,
          dayOfMonth: Math.min(Number(dueDate.slice(8)) || 1, 28),
          count: repeat === "parcelada" ? Number(count) || 2 : undefined,
          totalAmount: cents,
          startDate: dueDate,
          nature,
          description: description.trim(),
          categoryId: categoryId === NONE ? undefined : categoryId,
          accountId: accountId === NONE ? undefined : accountId,
          clientId: clientId === NONE ? undefined : clientId,
          createdAt: new Date().toISOString(),
        });
        toast.success(
          repeat === "parcelada"
            ? `Parcelamento criado. As parcelas aparecem como previsão.`
            : "Série recorrente criada. Nada do futuro foi gravado — é projeção.",
        );
        onOpenChange(false);
        return;
      }

      const next: FinanceEntry = {
        id: entry?.id ?? uid("fin"),
        nature,
        description,
        amount: cents,
        dueDate,
        competence: monthOf(dueDate),
        status: entry?.status ?? "pendente",
        settledAt: entry?.settledAt,
        accountId: accountId === NONE ? undefined : accountId,
        categoryId: categoryId === NONE ? undefined : categoryId,
        clientId: clientId === NONE ? undefined : clientId,
        note: note.trim() || undefined,
        seriesId: entry?.seriesId,
        seriesPosition: entry?.seriesPosition,
        origin: entry?.origin ?? "manual",
        reversalOf: entry?.reversalOf,
        createdAt: entry?.createdAt ?? new Date().toISOString(),
      };
      const invalid = validateEntry(next);
      if (invalid) {
        toast.error(invalid);
        return;
      }
      await saveEntry(next);
      toast.success(isEdit ? "Lançamento salvo." : "Lançamento criado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="font-display text-lg">
            {isEdit ? "Lançamento" : "Novo lançamento"}
          </DialogTitle>
          {settled && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Liquidado: o valor não muda mais. Para corrigir, estorne.
            </p>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex gap-2">
            {(["despesa", "receita"] as EntryNature[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNature(n)}
                aria-pressed={nature === n}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors",
                  nature === n
                    ? n === "receita"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-destructive bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fin-desc">Descrição *</Label>
            <Input
              id="fin-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mensalidade Aurora Café"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fin-amount">Valor *</Label>
              <Input
                id="fin-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1.500,00"
                disabled={settled && !canEditAmount(entry!)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-due">Vencimento *</Label>
              <Input
                id="fin-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger aria-label="Conta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem conta</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger aria-label="Categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem categoria</SelectItem>
                  {categories
                    .filter((c) => c.nature === nature)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger aria-label="Cliente">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem cliente</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label>Repetir</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Select value={repeat} onValueChange={(v) => setRepeat(v as typeof repeat)}>
                  <SelectTrigger aria-label="Repetição">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não repetir</SelectItem>
                    <SelectItem value="recorrente">Recorrente (sem fim)</SelectItem>
                    <SelectItem value="parcelada">Parcelado</SelectItem>
                  </SelectContent>
                </Select>
                {repeat === "parcelada" && (
                  <Input
                    type="number"
                    min={2}
                    max={60}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    aria-label="Número de parcelas"
                    placeholder="parcelas"
                  />
                )}
                {repeat !== "nao" && (
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={everyMonths}
                    onChange={(e) => setEveryMonths(e.target.value)}
                    aria-label="Intervalo em meses"
                    placeholder="a cada N meses"
                  />
                )}
              </div>
              {repeat === "parcelada" && (
                <p className="text-[11px] text-muted-foreground">
                  O valor acima é o <strong>total</strong>; ele é dividido entre as parcelas,
                  com o arredondamento na última.
                </p>
              )}
              {repeat === "recorrente" && (
                <p className="text-[11px] text-muted-foreground">
                  Nada do futuro é gravado: as cobranças aparecem como previsão e viram
                  lançamento quando chega a hora.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fin-note">Observação</Label>
            <Textarea
              id="fin-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {isEdit && entry && entry.status !== "liquidado" && (
            <Button
              variant="ghost"
              className="text-rose-400 hover:bg-rose-500/10"
              onClick={() => {
                if (!window.confirm("Excluir este lançamento?")) return;
                void deleteEntry(entry.id)
                  .then(() => {
                    toast.success("Lançamento excluído.");
                    onOpenChange(false);
                  })
                  .catch((err) =>
                    toast.error(err instanceof Error ? err.message : "Não foi possível excluir."),
                  );
              }}
            >
              Excluir
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Fechar
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
