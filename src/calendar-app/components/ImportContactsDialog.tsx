import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, FileUp, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useApp } from "../store/AppProvider";
import { defaultStages, parseContactRows, previewImport, stagesOf } from "../crm";
import type { Deal } from "../types";
import { uid } from "../utils";

/**
 * Importing a contact list (benchmark ficha 10).
 *
 * Nothing is written before the person sees what the import would do.
 * Deduplication is by document, then e-mail, then phone — never by name
 * alone, which is how two different "João Silva" become one customer. A name
 * that matches is a warning, and the row still comes in if the person wants.
 *
 * Every contact records where it came from and when (LGPD): an import says
 * "importado de arquivo" with today's date, because "we don't remember" is
 * not an answer anyone wants to give.
 */
export default function ImportContactsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { deals, blocks, saveDeal } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => (text.trim() ? parseContactRows(text) : null), [text]);
  const preview = useMemo(
    () => (parsed ? previewImport(parsed.rows, deals, blocks) : []),
    [parsed, deals, blocks],
  );

  // Pre-select what is new and not blocked: the sensible default, still the
  // person's to change.
  const importable = useMemo(
    () =>
      preview
        .map((p, index) => ({ p, index }))
        .filter(({ p }) => !p.blocked && !p.duplicateOf),
    [preview],
  );
  const selection = picked.size > 0 ? picked : new Set(importable.map((i) => i.index));

  async function run() {
    const chosen = preview.filter((p, index) => selection.has(index) && !p.blocked);
    if (chosen.length === 0) return toast.error("Nada selecionado para importar.");
    setSaving(true);
    const now = new Date().toISOString();
    const stage = stagesOf(defaultStages(), "prospeccao")[0];
    try {
      for (const { row } of chosen) {
        const deal: Deal = {
          id: uid("deal"),
          phase: "prospeccao",
          stageId: stage?.id ?? "contato",
          name: row.name,
          company: row.company,
          document: row.document,
          origin: "importação",
          recurringValue: 0,
          oneOffValue: 0,
          status: "aberto",
          contacts:
            row.email || row.phone
              ? [
                  {
                    id: uid("ctt"),
                    name: row.name,
                    email: row.email,
                    phone: row.phone,
                    primary: true,
                    source: "importado de arquivo",
                    collectedAt: now,
                    lawfulBasis: "legítimo interesse",
                  },
                ]
              : [],
          createdAt: now,
          updatedAt: now,
        };
        await saveDeal(deal);
      }
      toast.success(`${chosen.length} contato(s) importado(s) para a prospecção.`);
      setText("");
      setPicked(new Set());
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu para importar.");
    } finally {
      setSaving(false);
    }
  }

  const blocked = preview.filter((p) => p.blocked).length;
  const duplicates = preview.filter((p) => p.duplicateOf).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
        </DialogHeader>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.vcf,.txt,text/csv,text/plain"
              className="hidden"
              aria-label="Arquivo de contatos"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setText(await file.text());
                setPicked(new Set());
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" /> Escolher arquivo
            </Button>
            <span className="text-[11px] text-muted-foreground">
              CSV ou VCF. Também dá para colar a lista abaixo.
            </span>
          </div>
          <Label htmlFor="imp-text" className="sr-only">
            Lista de contatos
          </Label>
          <Textarea
            id="imp-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPicked(new Set());
            }}
            placeholder={"Nome;Email;Telefone\nAurora Café;contato@aurora.com;61999990000"}
            className="min-h-24 font-mono text-xs"
          />
        </div>

        {parsed && (
          <>
            <p className="text-[11px] text-muted-foreground">
              {preview.length} linha(s) lida(s)
              {duplicates > 0 && ` · ${duplicates} já no funil`}
              {blocked > 0 && ` · ${blocked} na lista de bloqueio`}
              {parsed.errors.length > 0 && ` · ${parsed.errors.length} ilegível(is)`}. A
              deduplicação é por documento, depois e-mail, depois telefone — nunca por nome.
            </p>

            {parsed.errors.length > 0 && (
              <p className="text-[11px] text-destructive">{parsed.errors.slice(0, 3).join(" · ")}</p>
            )}

            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {preview.map((item, index) => {
                const existing = deals.find((d) => d.id === item.duplicateOf);
                return (
                  <li
                    key={index}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border border-border p-2",
                      item.blocked && "opacity-60",
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      disabled={!!item.blocked}
                      checked={selection.has(index)}
                      aria-label={`Importar ${item.row.name}`}
                      onCheckedChange={(on) =>
                        setPicked(() => {
                          const next = new Set(selection);
                          if (on) next.add(index);
                          else next.delete(index);
                          return next;
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.row.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {[item.row.company, item.row.email, item.row.phone, item.row.document]
                          .filter(Boolean)
                          .join(" · ") || "sem contato"}
                      </p>
                      {item.blocked && (
                        <p className="flex items-center gap-1 text-[11px] text-destructive">
                          <Ban className="h-3 w-3" /> {item.blocked}
                        </p>
                      )}
                      {item.duplicateOf && (
                        <p className="text-[11px] text-amber-600">
                          Já está no funil como “{existing?.name ?? "negócio existente"}”.
                        </p>
                      )}
                      {item.warning && (
                        <p className="flex items-center gap-1 text-[11px] text-amber-600">
                          <AlertTriangle className="h-3 w-3" /> {item.warning}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gap-1.5"
            disabled={saving || preview.length === 0}
            onClick={() => void run()}
          >
            <UserPlus className="h-3.5 w-3.5" /> Importar {selection.size || 0}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
