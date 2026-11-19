import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Billing, Service } from "../types";
import { BILLING_LABEL } from "../proposals";
import { formatMoney, parseMoney } from "../money";
import { useApp } from "../store/AppProvider";

const BILLINGS: Billing[] = [
  "mensal",
  "trimestral",
  "semestral",
  "anual",
  "unica",
  "por_hora",
];

/** One catalogue service (spec 06 §1). */
export default function ServiceEditor({
  open,
  service,
  onOpenChange,
}: {
  open: boolean;
  service: Service | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { services, createService, updateService } = useApp();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [included, setIncluded] = useState("");
  const [price, setPrice] = useState("");
  const [billing, setBilling] = useState<Billing>("mensal");
  const [active, setActive] = useState(true);
  const [publicInTable, setPublicInTable] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setCategory(service?.category ?? "");
    setDescription(service?.description ?? "");
    setIncluded((service?.included ?? []).join("\n"));
    setPrice(service ? formatMoney(service.price, false) : "");
    setBilling(service?.billing ?? "mensal");
    setActive(service?.active ?? true);
    setPublicInTable(service?.publicInTable ?? true);
  }, [open, service]);

  const save = async () => {
    const cents = parseMoney(price);
    if (cents === null) return toast.error("Informe um preço válido.");
    const payload = {
      name,
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      included: included
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      price: cents,
      billing,
      active,
      publicInTable,
      order: service?.order ?? services.length,
    };
    setBusy(true);
    try {
      if (service) await updateService(service.id, payload);
      else await createService(payload);
      toast.success(service ? "Serviço atualizado." : "Serviço criado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="font-display text-lg">
            {service ? "Serviço" : "Novo serviço"}
          </DialogTitle>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Nome *</Label>
            <Input
              id="svc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gestão de redes sociais"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="svc-price">Preço *</Label>
              <Input
                id="svc-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1.500,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cobrança</Label>
              <Select value={billing} onValueChange={(v) => setBilling(v as Billing)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLINGS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {BILLING_LABEL[b]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-cat">Categoria</Label>
            <Input
              id="svc-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Social media, tráfego, branding..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-desc">Descrição</Label>
            <Textarea
              id="svc-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-incl">O que está incluso (um por linha)</Label>
            <Textarea
              id="svc-incl"
              rows={4}
              value={included}
              onChange={(e) => setIncluded(e.target.value)}
              placeholder={"12 posts no feed\n8 stories\n2 reels"}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Switch id="svc-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="svc-active" className="cursor-pointer text-sm">
                Ativo
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="svc-public"
                checked={publicInTable}
                onCheckedChange={setPublicInTable}
              />
              <Label htmlFor="svc-public" className="cursor-pointer text-sm">
                Aparece na tabela pública
              </Label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
