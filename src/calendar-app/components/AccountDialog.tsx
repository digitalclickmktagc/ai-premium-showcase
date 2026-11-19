import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import type { AccountKind } from "../types";
import { parseMoney } from "../money";
import { todayISO, uid } from "../utils";
import { useApp } from "../store/AppProvider";

const KINDS: { id: AccountKind; label: string }[] = [
  { id: "banco", label: "Conta bancária" },
  { id: "caixa", label: "Caixa" },
  { id: "carteira", label: "Carteira digital" },
];

/** A place money sits (spec 08 §1). */
export default function AccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { saveAccount } = useApp();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("banco");
  const [initial, setInitial] = useState("0,00");
  const [since, setSince] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setKind("banco");
    setInitial("0,00");
    setSince(todayISO());
  }, [open]);

  const save = async () => {
    const cents = parseMoney(initial);
    if (cents === null) return toast.error("Informe um saldo inicial válido.");
    setBusy(true);
    try {
      await saveAccount({
        id: uid("acc"),
        name,
        kind,
        initialBalance: cents,
        initialBalanceDate: since,
        active: true,
        createdAt: new Date().toISOString(),
      });
      toast.success("Conta criada.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="font-display text-lg">Nova conta</DialogTitle>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Nome *</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Banco Inter"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as AccountKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="acc-initial">Saldo inicial</Label>
              <Input
                id="acc-initial"
                value={initial}
                onChange={(e) => setInitial(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-since">Nessa data</Label>
              <Input
                id="acc-since"
                type="date"
                value={since}
                onChange={(e) => setSince(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Salvando..." : "Criar conta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
