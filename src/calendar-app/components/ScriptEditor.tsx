import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, Film, Plus, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useApp } from "../store/AppProvider";
import {
  MAX_SCENES,
  OPTIONAL_FIELDS,
  SCREEN_KIND_LABEL,
  STATUS_LABEL,
  canAddScene,
  formatDuration,
  newScene,
  newScript,
  reviewScript,
  spokenWords,
  statusFromPost,
  toPlainText,
  totalSeconds,
  validateScript,
} from "../scripts";
import type { Post, Script, ScriptKind, ScriptScene, StoryScreenKind } from "../types";
import { contextRoteiro, readSceneSuggestions } from "../ai";
import AiDialog from "./AiDialog";

/** How long each format usually takes, for the warning only. */
const FORMAT_LIMIT: Record<ScriptKind, number> = { video: 90, stories: 15 * 40 };

/**
 * Roteiro de vídeo ou de stories (benchmark ficha 17, F17c), inside the card
 * it belongs to. There is no separate approval link: the client decides on
 * the card, and the script's status follows that decision.
 */
export default function ScriptEditor({ post }: { post: Post }) {
  const { scripts, saveScript, deleteScript } = useApp();
  const mine = useMemo(() => scripts.filter((s) => s.postId === post.id), [scripts, post.id]);
  const [draft, setDraft] = useState<Script | null>(mine[0] ?? null);

  // Reload when the stored script changes under us (another tab, a reload).
  useEffect(() => {
    setDraft((current) => {
      const stored = mine.find((s) => s.id === current?.id) ?? mine[0] ?? null;
      if (!current) return stored;
      if (stored && stored.version > current.version) return stored;
      return current;
    });
  }, [mine]);

  const status = statusFromPost(post);

  async function create(kind: ScriptKind) {
    const script = newScript(kind, post.id, post.title);
    const saved = await saveScript(script);
    setDraft(saved);
    toast.success("Roteiro criado.");
  }

  if (!draft) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          O roteiro mora no card: quem vai ao cliente é o card, com a aprovação de sempre. As
          observações de cena são internas e nunca saem daqui.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void create("video")}>
            <Film className="h-3.5 w-3.5" /> Roteiro de vídeo
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void create("stories")}>
            <Smartphone className="h-3.5 w-3.5" /> Roteiro de stories
          </Button>
        </div>
      </div>
    );
  }

  const isStories = draft.kind === "stories";
  const total = totalSeconds(draft);
  const warnings = reviewScript(draft, FORMAT_LIMIT[draft.kind]);
  const problem = validateScript(draft);
  const on = (field: string) => draft.fields.includes(field);

  const set = (patch: Partial<Script>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const patchScene = (id: string, patch: Partial<ScriptScene>) =>
    set({ scenes: draft.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  async function save() {
    if (problem) return toast.error(problem);
    try {
      const saved = await saveScript({ ...draft, status });
      setDraft(saved);
      toast.success("Roteiro salvo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu para salvar.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          aria-label="Nome do roteiro"
          className="h-9 min-w-[10rem] flex-1"
        />
        <span className="text-[11px] text-muted-foreground">{STATUS_LABEL[status]}</span>
        <Button size="sm" onClick={() => void save()}>
          Salvar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={() => {
            navigator.clipboard
              .writeText(toPlainText(draft))
              .then(() => toast.success("Roteiro copiado (sem as observações internas)."))
              .catch(() => toast.error("Não deu para copiar."));
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-destructive"
          onClick={() => {
            if (!window.confirm("Apagar este roteiro?")) return;
            void deleteScript(draft.id).then(() => {
              setDraft(null);
              toast.success("Roteiro apagado.");
            });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="sc-goal" className="text-[11px]">
            Objetivo
          </Label>
          <Input
            id="sc-goal"
            value={draft.goal ?? ""}
            onChange={(e) => set({ goal: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sc-audience" className="text-[11px]">
            Público
          </Label>
          <Input
            id="sc-audience"
            value={draft.audience ?? ""}
            onChange={(e) => set({ audience: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sc-tone" className="text-[11px]">
            Tom
          </Label>
          <Input
            id="sc-tone"
            value={draft.tone ?? ""}
            onChange={(e) => set({ tone: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sc-cta" className="text-[11px]">
            Chamada para ação
          </Label>
          <Input
            id="sc-cta"
            value={draft.cta ?? ""}
            onChange={(e) => set({ cta: e.target.value })}
            className="h-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-foreground/[0.03] p-2 text-[11px]">
        <span className="font-medium">Colunas:</span>
        {OPTIONAL_FIELDS.map((field) => (
          <label key={field.id} className="flex items-center gap-1.5 text-muted-foreground">
            <Checkbox
              checked={on(field.id)}
              aria-label={`Mostrar ${field.label}`}
              onCheckedChange={(checked) =>
                set({
                  fields: checked
                    ? [...draft.fields, field.id]
                    : draft.fields.filter((f) => f !== field.id),
                })
              }
            />
            {field.label}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AiDialog
          action="rascunhar_roteiro"
          applyLabel={isStories ? "Usar estas telas" : "Usar estas cenas"}
          context={() =>
            contextRoteiro({
              post: {
                title: post.title,
                description: post.description,
                contentType: post.contentType,
              },
              clientName: "",
              kind: draft.kind,
              seconds: FORMAT_LIMIT[draft.kind],
              tone: draft.tone,
            })
          }
          onApply={(text) => {
            const cenas = readSceneSuggestions(text);
            if (cenas.length === 0) {
              toast.error("Não consegui ler cenas nessa resposta. Tente perguntar de novo.");
              return false;
            }
            // Substitui o rascunho: as cenas que havia continuam salvas na
            // versão anterior do roteiro até alguém salvar esta.
            set({
              scenes: cenas.slice(0, MAX_SCENES[draft.kind]).map((c) => ({
                ...newScene(draft.kind),
                speech: c.fala,
                onScreen: c.texto_na_tela,
                shot: c.plano,
                seconds: c.segundos ?? 5,
              })),
            });
            toast.success(
              `${cenas.length} ${isStories ? "tela(s)" : "cena(s)"} no rascunho. Revise e salve.`,
            );
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span>
          {draft.scenes.length} de {MAX_SCENES[draft.kind]} {isStories ? "telas" : "cenas"}
        </span>
        <span>· {formatDuration(total)} no total</span>
        <span>· {spokenWords(draft)} palavra(s) faladas</span>
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((warning, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-600">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {warning.message}
            </li>
          ))}
        </ul>
      )}

      <ol className="space-y-2">
        {draft.scenes.map((scene, index) => (
          <li key={scene.id} className="rounded-lg border border-border p-2">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {isStories ? `Tela ${index + 1}` : `Cena ${index + 1}`}
              </span>
              {isStories && (
                <Select
                  value={scene.screenKind ?? "texto"}
                  onValueChange={(v) => patchScene(scene.id, { screenKind: v as StoryScreenKind })}
                >
                  <SelectTrigger className="h-7 w-[180px] text-xs" aria-label={`Tipo da tela ${index + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCREEN_KIND_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {on("shot") && !isStories && (
                <Input
                  value={scene.shot ?? ""}
                  onChange={(e) => patchScene(scene.id, { shot: e.target.value })}
                  aria-label={`Plano da cena ${index + 1}`}
                  placeholder="Plano"
                  className="h-7 w-28 text-xs"
                />
              )}
              {on("seconds") && (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    value={scene.seconds ?? 0}
                    onChange={(e) => patchScene(scene.id, { seconds: Number(e.target.value) || 0 })}
                    aria-label={`Duração da ${isStories ? "tela" : "cena"} ${index + 1}`}
                    className="h-7 w-16 text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">s</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-7 w-7"
                aria-label={`Remover ${isStories ? "tela" : "cena"} ${index + 1}`}
                onClick={() => set({ scenes: draft.scenes.filter((s) => s.id !== scene.id) })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            <Textarea
              value={scene.speech ?? ""}
              onChange={(e) => patchScene(scene.id, { speech: e.target.value })}
              aria-label={`Fala da ${isStories ? "tela" : "cena"} ${index + 1}`}
              placeholder={isStories ? "O que a tela diz" : "Fala"}
              className="min-h-16 text-sm"
            />

            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              {on("onScreen") && (
                <Input
                  value={scene.onScreen ?? ""}
                  onChange={(e) => patchScene(scene.id, { onScreen: e.target.value })}
                  aria-label={`Texto na tela da ${isStories ? "tela" : "cena"} ${index + 1}`}
                  placeholder="Texto na tela"
                  className="h-8 text-xs"
                />
              )}
              {on("soundtrack") && (
                <Input
                  value={scene.soundtrack ?? ""}
                  onChange={(e) => patchScene(scene.id, { soundtrack: e.target.value })}
                  aria-label={`Trilha da ${isStories ? "tela" : "cena"} ${index + 1}`}
                  placeholder="Trilha"
                  className="h-8 text-xs"
                />
              )}
              {on("imageUrl") && (
                <Input
                  value={scene.imageUrl ?? ""}
                  onChange={(e) => patchScene(scene.id, { imageUrl: e.target.value })}
                  aria-label={`Referência da ${isStories ? "tela" : "cena"} ${index + 1}`}
                  placeholder="Link da referência"
                  className="h-8 text-xs"
                />
              )}
              {on("notes") && (
                <Input
                  value={scene.notes ?? ""}
                  onChange={(e) => patchScene(scene.id, { notes: e.target.value })}
                  aria-label={`Observação interna da ${isStories ? "tela" : "cena"} ${index + 1}`}
                  placeholder="Observação interna"
                  className={cn("h-8 text-xs", "border-dashed")}
                />
              )}
            </div>
          </li>
        ))}
      </ol>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={!canAddScene(draft)}
        onClick={() => set({ scenes: [...draft.scenes, newScene(draft.kind)] })}
      >
        <Plus className="h-3.5 w-3.5" /> {isStories ? "Tela" : "Cena"}
      </Button>

      {problem && <p className="text-[11px] text-destructive">{problem}</p>}
    </div>
  );
}
