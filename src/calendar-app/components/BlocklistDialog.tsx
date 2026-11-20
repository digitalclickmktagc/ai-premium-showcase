import { useState } from "react";
import { Ban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "../store/AppProvider";
import type { ContactBlock } from "../types";
import { formatShortDay, uid } from "../utils";

const KIND_LABEL: Record<ContactBlock["kind"], string> = {
  email: "E-mail",
  dominio: "Domínio",
  telefone: "Telefone",
};

/**
 * Lista de bloqueio (benchmark ficha 10).
 *
 * "Não me procure mais" é primeira classe: quem está aqui não entra por
 * importação e não recebe cadência. Um domínio bloqueia a empresa inteira —
 * é o pedido que a pessoa de verdade faz quando diz "não falem com a gente".
 */
export default function BlocklistDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { blocks, saveBlock, deleteBlock } = useApp();
  const [kind, setKind] = useState<ContactBlock["kind"]>("email");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  async function add() {
    if (!value.trim()) return toast.error("Informe o contato a bloquear.");
    await saveBlock({
      id: uid("blk"),
      kind,
      value: value.trim(),
      reason: reason.trim() || undefined,
      at: new Date().toISOString(),
    });
    setValue("");
    setReason("");
    toast.success("Bloqueado.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lista de bloqueio</DialogTitle>
        </DialogHeader>

        <p className="text-[11px] text-muted-foreground">
          Quem está aqui não entra por importação e não recebe cadência. Bloquear um domínio
          bloqueia todos os endereços dele.
        </p>

        <div className="grid gap-2 sm:grid-cols-[130px,1fr,1fr,auto]">
          <div className="grid gap-1">
            <Label htmlFor="bl-kind" className="text-[11px]">
              Tipo
            </Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ContactBlock["kind"])}>
              <SelectTrigger id="bl-kind" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="bl-value" className="text-[11px]">
              Contato
            </Label>
            <Input
              id="bl-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === "dominio" ? "empresa.com.br" : "contato@empresa.com"}
              className="h-9"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="bl-reason" className="text-[11px]">
              Motivo
            </Label>
            <Input
              id="bl-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="pediu para não receber"
              className="h-9"
            />
          </div>
          <Button className="h-9 self-end gap-1.5" onClick={() => void add()}>
            <Plus className="h-3.5 w-3.5" /> Bloquear
          </Button>
        </div>

        {blocks.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Ninguém bloqueado por enquanto.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {blocks.map((block) => (
              <li key={block.id} className="flex items-center gap-2 py-2">
                <Ban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{block.value}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {KIND_LABEL[block.kind]}
                    {block.reason && ` · ${block.reason}`} · {formatShortDay(block.at.slice(0, 10))}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={`Remover bloqueio de ${block.value}`}
                  onClick={async () => {
                    await deleteBlock(block.id);
                    toast.success("Bloqueio removido.");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
