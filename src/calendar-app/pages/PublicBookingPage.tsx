import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { addDays } from "date-fns";
import { CalendarCheck, CalendarX2, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Availability, BookingPage } from "../types";
import { getDataService } from "../services";
import { freeSlots, splitDateTime, validateBooking, type Slot } from "../agenda";
import { formatLongDay, formatShortDay, toDayISO } from "../utils";
import EmptyState from "../components/EmptyState";

/** How far ahead a visitor may book. */
const HORIZON_DAYS = 45;

/**
 * Public booking page (spec 04 §4.7).
 *
 * The visitor is anonymous and sees exactly two things: when the agency is
 * free, and their own confirmation. Busy blocks arrive with no name attached,
 * and a paused page is indistinguishable from one that never existed.
 */
export default function PublicBookingPage() {
  const { linkId = "" } = useParams();
  const [params] = useSearchParams();
  const service = useMemo(() => getDataService(), []);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<BookingPage | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [busy, setBusy] = useState<Slot[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState<{ start: string; manageToken: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.getPublicBookingPage(linkId);
      if (!res) {
        setPage(null);
        return;
      }
      setPage(res.page);
      setAvailability(res.availability);
      const from = toDayISO(new Date());
      const to = toDayISO(addDays(new Date(), HORIZON_DAYS));
      setBusy((await service.getPublicBusy(linkId, from, to)) ?? []);
    } catch {
      setPage(null);
    } finally {
      setLoading(false);
    }
  }, [service, linkId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Cancelling from the e-mail link: /agendar/:linkId?cancelar=<token>
  const cancelToken = params.get("cancelar");
  useEffect(() => {
    if (!cancelToken) return;
    (async () => {
      try {
        await service.cancelPublicBooking(cancelToken);
        toast.success("Reserva cancelada.");
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível cancelar.");
      }
    })();
  }, [cancelToken, service, load]);

  const days = useMemo(() => {
    if (!availability) return [];
    const out: { day: string; slots: Slot[] }[] = [];
    for (let i = 0; i <= HORIZON_DAYS; i += 1) {
      const d = toDayISO(addDays(new Date(), i));
      const slots = freeSlots(d, availability, busy);
      if (slots.length > 0) out.push({ day: d, slots });
    }
    return out;
  }, [availability, busy]);

  const slotsOfDay = days.find((d) => d.day === day)?.slots ?? [];

  const submit = async () => {
    if (!slot) return;
    const invalid = validateBooking({ name, email });
    if (invalid) return toast.error(invalid);
    setSending(true);
    try {
      const res = await service.createPublicBooking(linkId, {
        name,
        email,
        start: slot.start,
        note,
      });
      setConfirmed({ start: res.start, manageToken: res.manageToken });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível agendar.");
      await load(); // someone may have taken the slot while the form was open
      setSlot(null);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="ce-app flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!page || !availability) {
    return (
      <div className="ce-app flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <EmptyState
          icon={<CalendarX2 className="h-10 w-10" />}
          title="Link indisponível"
          description="Este link de agendamento não está ativo. Peça um novo à agência."
        />
      </div>
    );
  }

  if (confirmed) {
    const when = splitDateTime(confirmed.start);
    const cancelUrl = `${window.location.origin}${window.location.pathname}?cancelar=${confirmed.manageToken}`;
    return (
      <div className="ce-app min-h-[100dvh] bg-background px-4 py-12 text-foreground">
        <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h1 className="font-display text-xl font-bold">Horário confirmado</h1>
          <p className="text-sm">
            {formatLongDay(when.date)} às <strong>{when.time}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Guarde este link caso precise desmarcar:
          </p>
          <code className="block break-all rounded-lg bg-muted px-3 py-2 text-[11px]">
            {cancelUrl}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(cancelUrl);
              toast.success("Link copiado.");
            }}
          >
            Copiar link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="ce-app min-h-[100dvh] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="space-y-1 text-center">
          <CalendarCheck className="mx-auto h-8 w-8 text-primary" />
          <h1 className="font-display text-2xl font-bold">{page.title}</h1>
          {page.intro && <p className="text-sm text-muted-foreground">{page.intro}</p>}
          <p className="text-xs text-muted-foreground">
            Conversas de {availability.durationMinutes} minutos · horários no seu fuso
          </p>
        </header>

        {days.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhum horário livre nos próximos {HORIZON_DAYS} dias.
          </p>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Escolha o dia
            </p>
            <div className="flex flex-wrap gap-1.5">
              {days.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => {
                    setDay(d.day);
                    setSlot(null);
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    day === d.day
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {formatShortDay(d.day)}
                  <span className="ml-1 opacity-60">{d.slots.length}</span>
                </button>
              ))}
            </div>

            {day && (
              <>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Horários em {formatLongDay(day)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {slotsOfDay.map((s) => {
                    const time = splitDateTime(s.start).time;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        onClick={() => setSlot(s)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-colors",
                          slot?.start === s.start
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {slot && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className="text-sm">
              {formatLongDay(splitDateTime(slot.start).date)} às{" "}
              <strong>{splitDateTime(slot.start).time}</strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bk-name">Seu nome *</Label>
                <Input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-email">Seu e-mail *</Label>
                <Input
                  id="bk-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-note">Assunto (opcional)</Label>
              <Textarea
                id="bk-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button onClick={submit} disabled={sending} className="w-full">
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar horário
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
