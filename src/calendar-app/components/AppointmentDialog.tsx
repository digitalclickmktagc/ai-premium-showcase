import { useEffect, useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
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
import { useApp } from "../store/AppProvider";
import { validateAppointment } from "../agenda";
import { todayISO } from "../utils";

const NO_CLIENT = "__none__";

/** Create or edit one appointment. Cancelling never deletes (spec 04 §3). */
export default function AppointmentDialog({
  open,
  onOpenChange,
  appointmentId,
  defaultDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId?: string | null;
  defaultDay?: string;
}) {
  const { appointments, clients, createAppointment, updateAppointment, cancelAppointment } =
    useApp();
  const existing = appointmentId
    ? appointments.find((a) => a.id === appointmentId)
    : undefined;
  const isEdit = Boolean(existing);

  const [title, setTitle] = useState("");
  const [day, setDay] = useState(todayISO());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [clientId, setClientId] = useState<string>(NO_CLIENT);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitle(existing.title);
      setDay(existing.start.slice(0, 10));
      setStartTime(existing.start.slice(11, 16));
      setEndTime(existing.end.slice(11, 16));
      setClientId(existing.clientId ?? NO_CLIENT);
      setLocation(existing.location ?? "");
      setDescription(existing.description ?? "");
    } else {
      setTitle("");
      setDay(defaultDay ?? todayISO());
      setStartTime("09:00");
      setEndTime("10:00");
      setClientId(NO_CLIENT);
      setLocation("");
      setDescription("");
    }
  }, [open, existing, defaultDay]);

  const save = async () => {
    const payload = {
      title,
      start: `${day}T${startTime}:00`,
      end: `${day}T${endTime}:00`,
      clientId: clientId === NO_CLIENT ? undefined : clientId,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      status: "marcado" as const,
      source: "manual" as const,
    };
    const invalid = validateAppointment(payload);
    if (invalid) return toast.error(invalid);

    setBusy(true);
    try {
      if (existing) {
        await updateAppointment(existing.id, payload);
        toast.success("Compromisso atualizado.");
      } else {
        await createAppointment(payload);
        toast.success("Compromisso marcado.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!existing) return;
    if (!window.confirm(`Cancelar "${existing.title}"? O registro é mantido.`)) return;
    try {
      await cancelAppointment(existing.id);
      toast.success("Compromisso cancelado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível cancelar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          "max-sm:h-[100dvh] max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
          "sm:max-h-[90vh] sm:max-w-lg",
        )}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <CalendarClock className="mt-0.5 h-4 w-4 text-primary" />
          <DialogTitle className="font-display text-lg">
            {isEdit ? "Compromisso" : "Novo compromisso"}
          </DialogTitle>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="appt-title">Título *</Label>
            <Input
              id="appt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reunião de pauta"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-day">Dia</Label>
              <Input id="appt-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-start">Início</Label>
              <Input
                id="appt-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-end">Fim</Label>
              <Input
                id="appt-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CLIENT}>Sem cliente</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-place">Local ou link</Label>
            <Input
              id="appt-place"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Google Meet, escritório..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-desc">Observações</Label>
            <Textarea
              id="appt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {existing?.status === "cancelado" && (
            <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              Este compromisso está cancelado. Ele fica no histórico e sai da agenda.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {isEdit && existing?.status === "marcado" && (
            <Button
              variant="ghost"
              onClick={cancel}
              className="gap-1.5 text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" /> Cancelar compromisso
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Fechar
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Salvando..." : isEdit ? "Salvar" : "Marcar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
