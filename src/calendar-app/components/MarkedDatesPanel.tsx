import { useMemo, useState } from "react";
import { CalendarHeart, ChevronDown, Minus, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApp } from "../store/AppProvider";
import { markedDatesInMonth } from "../holidays";
import { formatShortDay } from "../utils";

/**
 * Marked dates of the month (spec 04 §4.5).
 *
 * The catalogue is computed, not stored — movable feasts come from Easter, so
 * no year ever runs out of holidays. Only what the agency chooses to keep is
 * written down, and only those show on the agenda.
 */
export default function MarkedDatesPanel({ month }: { month: string }) {
  const { markedDates, addMarkedDate, removeMarkedDate } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const catalogue = useMemo(() => markedDatesInMonth(month), [month]);
  const kept = useMemo(() => new Set(markedDates.map((d) => d.id)), [markedDates]);
  const missing = catalogue.filter((d) => !kept.has(d.id));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const addAll = () =>
    run(async () => {
      for (const d of missing) await addMarkedDate(d);
      toast.success(
        missing.length === 1 ? "1 data adicionada." : `${missing.length} datas adicionadas.`,
      );
    });

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <CalendarHeart className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Datas marcantes do mês
        </span>
        <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground">
          {catalogue.length - missing.length}/{catalogue.length} na agenda
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-2 border-t border-border p-3">
          {catalogue.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma data neste mês.</p>
          ) : (
            <>
              <ul className="space-y-1">
                {catalogue.map((d) => {
                  const on = kept.has(d.id);
                  return (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="w-20 shrink-0 text-[11px] text-muted-foreground">
                        {formatShortDay(d.date)}
                      </span>
                      <span className="flex-1 truncate text-sm">{d.name}</span>
                      {d.sensitive && (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400"
                          title="Data sensível: pense duas vezes antes de postar"
                        >
                          <ShieldAlert className="h-3 w-3" /> sensível
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() => (on ? removeMarkedDate(d.id) : addMarkedDate(d)))
                        }
                        aria-label={on ? `Tirar ${d.name} da agenda` : `Adicionar ${d.name} à agenda`}
                        className={cn(
                          "shrink-0 rounded-md p-1 transition-colors",
                          on
                            ? "text-muted-foreground hover:text-destructive"
                            : "text-primary hover:bg-primary/10",
                        )}
                      >
                        {on ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {missing.length > 0 && (
                <Button size="sm" variant="outline" onClick={addAll} disabled={busy}>
                  Adicionar todas ({missing.length})
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
