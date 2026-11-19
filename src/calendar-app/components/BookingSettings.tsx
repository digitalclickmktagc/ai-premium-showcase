import { useEffect, useState } from "react";
import { CalendarCheck, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Availability, AvailabilityWindow } from "../types";
import { DEFAULT_AVAILABILITY } from "../agenda";
import { useApp } from "../store/AppProvider";
import ShareLink from "./ShareLink";

const WEEKDAYS = [
  { day: 0, label: "Dom" },
  { day: 1, label: "Seg" },
  { day: 2, label: "Ter" },
  { day: 3, label: "Qua" },
  { day: 4, label: "Qui" },
  { day: 5, label: "Sex" },
  { day: 6, label: "Sáb" },
];

/**
 * Availability and the public booking page (spec 04 §4.6).
 *
 * Pausing the page is the only "delete" there is: a paused link answers
 * exactly like one that never existed, so nobody can tell it was ever live.
 */
export default function BookingSettings() {
  const { availability, bookingPage, saveBookingConfig, regenerateBookingLink, bookings } =
    useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [draft, setDraft] = useState<Availability>(availability ?? DEFAULT_AVAILABILITY);
  const [active, setActive] = useState(bookingPage?.active ?? false);
  const [title, setTitle] = useState(bookingPage?.title ?? "Agendar uma conversa");
  const [intro, setIntro] = useState(bookingPage?.intro ?? "");

  useEffect(() => {
    setDraft(availability ?? DEFAULT_AVAILABILITY);
    setActive(bookingPage?.active ?? false);
    setTitle(bookingPage?.title ?? "Agendar uma conversa");
    setIntro(bookingPage?.intro ?? "");
  }, [availability, bookingPage]);

  const upcoming = bookings.filter(
    (b) => b.status === "confirmada" && b.start >= new Date().toISOString(),
  ).length;

  const setWindow = (day: number, index: number, patch: Partial<AvailabilityWindow>) =>
    setDraft((d) => {
      const list = [...(d.weekdays[day] ?? [])];
      list[index] = { ...list[index], ...patch };
      return { ...d, weekdays: { ...d.weekdays, [day]: list } };
    });

  const toggleDay = (day: number, on: boolean) =>
    setDraft((d) => ({
      ...d,
      weekdays: {
        ...d.weekdays,
        [day]: on ? [{ start: "09:00", end: "18:00" }] : [],
      },
    }));

  const addWindow = (day: number) =>
    setDraft((d) => ({
      ...d,
      weekdays: {
        ...d.weekdays,
        [day]: [...(d.weekdays[day] ?? []), { start: "14:00", end: "18:00" }],
      },
    }));

  const save = async () => {
    for (const [day, list] of Object.entries(draft.weekdays)) {
      for (const w of list ?? []) {
        if (w.end <= w.start) {
          toast.error(`Em ${WEEKDAYS[Number(day)].label}, o fim precisa ser depois do início.`);
          return;
        }
      }
    }
    setBusy(true);
    try {
      await saveBookingConfig({ availability: draft, page: { active, title, intro } });
      toast.success("Disponibilidade salva.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <CalendarCheck className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Agendamento público
        </span>
        <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground">
          {active ? `no ar · ${upcoming} marcada(s)` : "pausado"}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-3">
          <div className="flex items-center gap-2">
            <Switch id="booking-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="booking-active" className="cursor-pointer text-sm">
              Página no ar
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Pausada, o link responde como se nunca tivesse existido.
            </span>
          </div>

          {bookingPage?.linkId && (
            <ShareLink
              token={bookingPage.linkId}
              basePath="/agendar"
              onRegenerate={async () => {
                if (
                  window.confirm(
                    "Gerar um novo link invalida o anterior. Reservas já feitas continuam valendo. Continuar?",
                  )
                ) {
                  await regenerateBookingLink();
                }
              }}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="booking-title">Título da página</Label>
              <Input
                id="booking-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-duration">Duração (min)</Label>
              <Input
                id="booking-duration"
                type="number"
                min={5}
                max={480}
                step={5}
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, durationMinutes: Number(e.target.value) || 30 }))
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-notice">Antecedência mínima (h)</Label>
              <Input
                id="booking-notice"
                type="number"
                min={0}
                value={draft.noticeHours}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, noticeHours: Number(e.target.value) || 0 }))
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-gap">Intervalo entre reservas (min)</Label>
              <Input
                id="booking-gap"
                type="number"
                min={0}
                step={5}
                value={draft.gapMinutes}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, gapMinutes: Number(e.target.value) || 0 }))
                }
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="booking-intro">Apresentação</Label>
            <Textarea
              id="booking-intro"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={2}
              placeholder="Escolha um horário e conversamos sobre o seu projeto."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Dias e horários</Label>
            {WEEKDAYS.map(({ day, label }) => {
              const windows = draft.weekdays[day] ?? [];
              const on = windows.length > 0;
              return (
                <div key={day} className="flex flex-wrap items-center gap-2">
                  <div className="flex w-20 items-center gap-1.5">
                    <Switch
                      id={`day-${day}`}
                      checked={on}
                      onCheckedChange={(v) => toggleDay(day, v)}
                      aria-label={label}
                    />
                    <Label htmlFor={`day-${day}`} className="cursor-pointer text-xs">
                      {label}
                    </Label>
                  </div>
                  {windows.map((w, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Input
                        type="time"
                        value={w.start}
                        onChange={(e) => setWindow(day, i, { start: e.target.value })}
                        aria-label={`${label}: início da faixa ${i + 1}`}
                        className="h-8 w-[104px]"
                      />
                      <span className="text-xs text-muted-foreground">às</span>
                      <Input
                        type="time"
                        value={w.end}
                        onChange={(e) => setWindow(day, i, { end: e.target.value })}
                        aria-label={`${label}: fim da faixa ${i + 1}`}
                        className="h-8 w-[104px]"
                      />
                    </div>
                  ))}
                  {on && (
                    <button
                      type="button"
                      onClick={() => addWindow(day)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      + faixa
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "Salvando..." : "Salvar disponibilidade"}
          </Button>
        </div>
      )}
    </div>
  );
}
