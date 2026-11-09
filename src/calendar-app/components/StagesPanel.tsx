import { useState } from "react";
import { ChevronDown, ChevronUp, Columns3, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import type { BoardStage, PostStatus } from "../types";
import { statusConfig } from "../status";
import {
  MAX_STAGES,
  STAGE_CATEGORIES,
  canAddStage,
  canRemoveStage,
  categoryLabel,
  moveStage,
  standardStages,
  validateStageName,
} from "../stages";
import { useApp } from "../store/AppProvider";

/**
 * Editor for a calendar's board columns (benchmark spec 02).
 *
 * A column is a name and a position for one of the four statuses the rest of
 * the system already understands — that is what lets an agency run
 * "Roteiro → Gravação → Edição → Aprovação" without the client view, the
 * automations or the health index needing to know.
 *
 * A calendar starts with no columns of its own and uses the standard four.
 */
export default function StagesPanel({ calendarId }: { calendarId: string }) {
  const { stagesForCalendar, createStage, updateStage, deleteStage, reorderStages } =
    useApp();
  const stages = stagesForCalendar(calendarId);
  const custom = stages.length > 0;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<PostStatus>("todo");

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

  /** Start customising: materialise the standard four as real, editable columns. */
  const startCustom = () =>
    run(async () => {
      for (const s of standardStages(calendarId)) {
        await createStage({
          calendarId,
          name: s.name,
          color: s.color,
          category: s.category,
          order: s.order,
        });
      }
      toast.success("Agora as colunas deste quadro são suas. Renomeie à vontade.");
    });

  const backToDefault = () =>
    run(async () => {
      if (
        !window.confirm(
          "Voltar às colunas padrão? Os cards continuam onde estão — eles seguem o status, não a coluna.",
        )
      )
        return;
      for (const s of stages) await deleteStage(s.id);
      toast.success("Quadro de volta às colunas padrão.");
    });

  const add = () => {
    const full = canAddStage(stages);
    if (full) return toast.error(full);
    const invalid = validateStageName(newName, stages);
    if (invalid) return toast.error(invalid);
    void run(async () => {
      await createStage({
        calendarId,
        name: newName.trim(),
        color: statusConfig(newCategory).color,
        category: newCategory,
        order: stages.length,
      });
      setNewName("");
      toast.success("Coluna criada.");
    });
  };

  const rename = (stage: BoardStage, name: string) => {
    if (name.trim() === stage.name) return;
    const invalid = validateStageName(name, stages, stage.id);
    if (invalid) return toast.error(invalid);
    void run(() => updateStage(stage.id, { name: name.trim() }));
  };

  const remove = (stage: BoardStage) => {
    const blocked = canRemoveStage(stage, stages);
    if (blocked) return toast.error(blocked);
    if (!window.confirm(`Remover a coluna "${stage.name}"?`)) return;
    void run(async () => {
      await deleteStage(stage.id);
      toast.success("Coluna removida. Os cards foram para outra coluna do mesmo status.");
    });
  };

  const move = (stage: BoardStage, direction: -1 | 1) =>
    run(() =>
      reorderStages(
        moveStage(stages, stage.id, direction).map((s) => ({ id: s.id, order: s.order })),
      ),
    );

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Columns3 className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Colunas do quadro
        </span>
        <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground">
          {custom ? `${stages.length} próprias` : "padrão"}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-3">
          {!custom ? (
            <>
              <p className="text-xs text-muted-foreground">
                Este quadro usa as quatro etapas padrão. Você pode trocá-las pelo fluxo
                deste cliente — por exemplo Roteiro, Gravação, Edição, Aprovação. Cada
                coluna sua responde por um dos quatro status, que é o que o cliente e as
                automações enxergam.
              </p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={startCustom} disabled={busy}>
                <Plus className="h-3.5 w-3.5" /> Personalizar colunas
              </Button>
            </>
          ) : (
            <>
              <ul className="space-y-1.5">
                {stages.map((stage, i) => (
                  <li
                    key={stage.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5"
                  >
                    <input
                      type="color"
                      value={stage.color}
                      onChange={(e) => void run(() => updateStage(stage.id, { color: e.target.value }))}
                      aria-label={`Cor da coluna ${stage.name}`}
                      className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <Input
                      defaultValue={stage.name}
                      key={`${stage.id}-${stage.name}`}
                      onBlur={(e) => rename(stage, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      aria-label={`Nome da coluna ${stage.name}`}
                      className="h-8 w-32 flex-1 min-w-[8rem]"
                    />
                    <Select
                      value={stage.category}
                      onValueChange={(v) =>
                        void run(() => updateStage(stage.id, { category: v as PostStatus }))
                      }
                    >
                      <SelectTrigger
                        className="h-8 w-[130px]"
                        aria-label={`Status da coluna ${stage.name}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {categoryLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="ml-auto flex items-center">
                      <button
                        type="button"
                        onClick={() => void move(stage, -1)}
                        disabled={i === 0 || busy}
                        aria-label="Mover para a esquerda"
                        className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void move(stage, 1)}
                        disabled={i === stages.length - 1 || busy}
                        aria-label="Mover para a direita"
                        className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(stage)}
                        aria-label={`Remover a coluna ${stage.name}`}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      add();
                    }
                  }}
                  placeholder="Nova coluna (ex.: Edição)"
                  aria-label="Nome da nova coluna"
                  className="h-9"
                />
                <Select value={newCategory} onValueChange={(v) => setNewCategory(v as PostStatus)}>
                  <SelectTrigger className="h-9" aria-label="Status da nova coluna">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {categoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={add} disabled={busy}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-[11px] text-muted-foreground">
                  Até {MAX_STAGES} colunas. O status de cada coluna é o que o cliente e as
                  automações leem.
                </Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto gap-1.5 text-muted-foreground"
                  onClick={backToDefault}
                  disabled={busy}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Voltar ao padrão
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
