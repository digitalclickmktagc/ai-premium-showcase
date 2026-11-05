import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Client, ClientStatus } from "../types";
import { CLIENT_STATUS_LABEL, canTransition, normalizeStatus } from "../health";
import { CLIENT_COLORS, randomClientColor } from "../utils";
import { useApp } from "../store/AppProvider";

export default function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
  onCreated?: (info: { clientId: string; calendarId: string }) => void;
}) {
  const { createClient, updateClient } = useApp();
  const isEdit = Boolean(client);

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState(CLIENT_COLORS[0]);
  const [logoUrl, setLogoUrl] = useState("");
  const [status, setStatus] = useState<ClientStatus>("active");
  const [segment, setSegment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(client?.name ?? "");
    setHandle(client?.handle ?? "");
    setEmail(client?.email ?? "");
    setColor(client?.color ?? randomClientColor());
    setLogoUrl(client?.logoUrl ?? "");
    setStatus(client ? normalizeStatus(client) : "active");
    setSegment(client?.segment ?? "");
  }, [open, client]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && client) {
        await updateClient(client.id, {
          name,
          handle,
          email,
          color,
          logoUrl,
          status,
          segment,
        });
        toast.success("Cliente atualizado.");
        onOpenChange(false);
      } else {
        const { client: created, calendar } = await createClient({
          name,
          handle,
          email,
          color,
          logoUrl,
          status,
          segment,
        });
        toast.success("Cliente e calendário criados.");
        onOpenChange(false);
        onCreated?.({ clientId: created.id, calendarId: calendar.id });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? "Editar cliente" : "Novo cliente"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados e a identidade visual do cliente."
              : "Um calendário editorial é criado automaticamente para o cliente."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Nome *</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Aurora Café"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-handle">@ / Rede social</Label>
            <Input
              id="client-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="Ex.: @auroracafe"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-email">E-mail de contato</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@cliente.com"
            />
            <p className="text-xs text-muted-foreground">
              Destino do código de verificação quando o cliente aprovar um post.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Cor de identidade</Label>
            <div className="flex flex-wrap items-center gap-2">
              {CLIENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-110",
                    color === c ? "ring-white/80" : "ring-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label
                className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-border"
                title="Cor personalizada"
                style={{ backgroundColor: color }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-logo">Logo (URL, opcional)</Label>
            <Input
              id="client-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-segment">Segmento</Label>
              <Input
                id="client-segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex.: Alimentação"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-status">Situação</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
                <SelectTrigger id="client-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["active", "paused", "ended", "archived"] as ClientStatus[])
                    // only offer transitions the lifecycle allows
                    .filter((s) => !client || canTransition(normalizeStatus(client), s))
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {CLIENT_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
