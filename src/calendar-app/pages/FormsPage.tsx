import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Link2,
  Link2Off,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import AdminLayout from "../components/AdminLayout";
import EmptyState from "../components/EmptyState";
import ShareLink from "../components/ShareLink";
import { useApp } from "../store/AppProvider";
import {
  QUESTION_KIND_LABEL,
  newQuestion,
  summariseForm,
  validateForm,
} from "../forms";
import type { BriefingForm, FormQuestion, FormQuestionKind } from "../types";
import { formatTimestamp, shareToken, uid } from "../utils";

const NONE = "__none__";

/**
 * Formulários de briefing (benchmark ficha 17, F17b).
 *
 * Editing a form never touches the answers already given, and a question
 * taken out of the form keeps its answers in the summary under "pergunta
 * removida". Deleting the form is the one destructive action, and it says so.
 */
export default function FormsPage() {
  const { forms, formResponses, clients, saveForm, deleteForm } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(forms[0]?.id ?? null);
  const selected = forms.find((f) => f.id === selectedId) ?? forms[0];

  async function create() {
    const form: BriefingForm = {
      id: uid("form"),
      title: "Briefing de campanha",
      questions: [{ ...newQuestion("texto"), label: "Qual o objetivo desta campanha?", required: true }],
      status: "ativo",
      shareToken: shareToken(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveForm(form);
    setSelectedId(form.id);
    toast.success("Formulário criado.");
  }

  return (
    <AdminLayout section="formularios" title="Formulários">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Formulários</h1>
          <p className="text-xs text-muted-foreground">
            Briefing, pesquisa de satisfação, pedido de material — com link próprio e resumo das
            respostas.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => void create()}>
          <Plus className="h-4 w-4" /> Novo formulário
        </Button>
      </header>

      {forms.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Nenhum formulário ainda"
          description="Crie um para parar de pedir briefing por áudio no WhatsApp."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[240px,1fr]">
          <ul className="space-y-1">
            {forms.map((form) => {
              const count = formResponses.filter((r) => r.formId === form.id).length;
              return (
                <li key={form.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(form.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                      form.id === selected?.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-foreground/[0.03]",
                    )}
                  >
                    <span className="block truncate text-sm">{form.title}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {form.status === "ativo" ? "ativo" : "pausado"} · {count} resposta(s)
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected && (
            <FormEditor
              key={selected.id}
              form={selected}
              clients={clients}
              responseCount={formResponses.filter((r) => r.formId === selected.id).length}
              summary={summariseForm(selected, formResponses)}
              onSave={saveForm}
              onDelete={async () => {
                const count = formResponses.filter((r) => r.formId === selected.id).length;
                if (
                  !window.confirm(
                    count > 0
                      ? `Apagar o formulário e as ${count} resposta(s) que ele já recebeu? Isso não volta.`
                      : "Apagar este formulário?",
                  )
                )
                  return;
                await deleteForm(selected.id);
                setSelectedId(null);
                toast.success("Formulário apagado.");
              }}
            />
          )}
        </div>
      )}
    </AdminLayout>
  );
}

function FormEditor({
  form,
  clients,
  responseCount,
  summary,
  onSave,
  onDelete,
}: {
  form: BriefingForm;
  clients: { id: string; name: string }[];
  responseCount: number;
  summary: ReturnType<typeof summariseForm>;
  onSave: (f: BriefingForm) => Promise<BriefingForm>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(form);
  const problem = validateForm(draft);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(form), [draft, form]);

  const set = (patch: Partial<BriefingForm>) => setDraft((d) => ({ ...d, ...patch }));
  const patchQuestion = (id: string, patch: Partial<FormQuestion>) =>
    set({ questions: draft.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.questions.length) return;
    const next = [...draft.questions];
    [next[index], next[target]] = [next[target], next[index]];
    set({ questions: next });
  };

  const save = async (patch: Partial<BriefingForm> = {}) => {
    const next = { ...draft, ...patch };
    const invalid = validateForm(next);
    if (invalid) return toast.error(invalid);
    await onSave(next);
    setDraft(next);
    toast.success("Formulário salvo.");
  };

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button disabled={!!problem || !dirty} onClick={() => void save()}>
          Salvar
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => void save({ status: draft.status === "ativo" ? "pausado" : "ativo" })}
        >
          {draft.status === "ativo" ? (
            <>
              <Pause className="h-3.5 w-3.5" /> Pausar
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Reativar
            </>
          )}
        </Button>
        {draft.status === "ativo" ? (
          <ShareLink token={draft.shareToken} basePath="/responder" compact />
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Link2Off className="h-3.5 w-3.5" /> Pausado: o link não responde.
          </span>
        )}
        <Button
          variant="ghost"
          className="gap-1.5"
          onClick={() => {
            if (!window.confirm("Gerar um link novo invalida o anterior. Seguir?")) return;
            void save({ shareToken: shareToken() });
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Link novo
        </Button>
        <Button variant="ghost" className="ml-auto gap-1.5 text-destructive" onClick={() => void onDelete()}>
          <Trash2 className="h-3.5 w-3.5" /> Apagar
        </Button>
        {problem && <span className="text-xs text-destructive">{problem}</span>}
      </section>

      <Tabs defaultValue="perguntas">
        <TabsList>
          <TabsTrigger value="perguntas">Perguntas</TabsTrigger>
          <TabsTrigger value="respostas" className="gap-1.5">
            Respostas
            <span className="text-muted-foreground">{responseCount}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perguntas" className="mt-3 space-y-3">
          <section className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="fm-title">Título</Label>
              <Input
                id="fm-title"
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="fm-client">Cliente</Label>
              <Select
                value={draft.clientId ?? NONE}
                onValueChange={(v) => set({ clientId: v === NONE ? undefined : v })}
              >
                <SelectTrigger id="fm-client">
                  <SelectValue placeholder="Sem cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem cliente</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="fm-desc">Descrição</Label>
              <Textarea
                id="fm-desc"
                value={draft.description ?? ""}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="O que a pessoa precisa saber antes de responder."
                className="min-h-16"
              />
            </div>
          </section>

          {draft.questions.map((q, index) => (
            <section key={q.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={q.label}
                  onChange={(e) => patchQuestion(q.id, { label: e.target.value })}
                  aria-label={`Enunciado da pergunta ${index + 1}`}
                  placeholder="O que você quer perguntar?"
                  className="h-9 min-w-[12rem] flex-1"
                />
                <Select
                  value={q.kind}
                  onValueChange={(v) => {
                    const kind = v as FormQuestionKind;
                    patchQuestion(q.id, {
                      kind,
                      options:
                        kind === "lista" || kind === "multipla" ? (q.options ?? ["", ""]) : undefined,
                      scaleMin: kind === "escala" ? (q.scaleMin ?? 1) : undefined,
                      scaleMax: kind === "escala" ? (q.scaleMax ?? 5) : undefined,
                    });
                  }}
                >
                  <SelectTrigger className="h-9 w-[160px]" aria-label={`Tipo da pergunta ${index + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(QUESTION_KIND_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Checkbox
                    checked={q.required}
                    onCheckedChange={(on) => patchQuestion(q.id, { required: !!on })}
                    aria-label={`Pergunta ${index + 1} obrigatória`}
                  />
                  obrigatória
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={`Subir pergunta ${index + 1}`}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={`Descer pergunta ${index + 1}`}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={`Remover pergunta ${index + 1}`}
                  onClick={() => set({ questions: draft.questions.filter((x) => x.id !== q.id) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {(q.kind === "lista" || q.kind === "multipla") && (
                <div className="mt-2 space-y-1.5 pl-1">
                  {(q.options ?? []).map((option, oIndex) => (
                    <div key={oIndex} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) =>
                          patchQuestion(q.id, {
                            options: (q.options ?? []).map((o, i) =>
                              i === oIndex ? e.target.value : o,
                            ),
                          })
                        }
                        aria-label={`Opção ${oIndex + 1} da pergunta ${index + 1}`}
                        className="h-8 max-w-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Remover opção ${oIndex + 1} da pergunta ${index + 1}`}
                        onClick={() =>
                          patchQuestion(q.id, {
                            options: (q.options ?? []).filter((_, i) => i !== oIndex),
                          })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => patchQuestion(q.id, { options: [...(q.options ?? []), ""] })}
                  >
                    <Plus className="h-3 w-3" /> Opção
                  </Button>
                </div>
              )}

              {q.kind === "escala" && (
                <div className="mt-2 flex items-end gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor={`min-${q.id}`} className="text-[11px]">
                      De
                    </Label>
                    <Input
                      id={`min-${q.id}`}
                      type="number"
                      value={q.scaleMin ?? 1}
                      onChange={(e) => patchQuestion(q.id, { scaleMin: Number(e.target.value) })}
                      className="h-8 w-20"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`max-${q.id}`} className="text-[11px]">
                      Até
                    </Label>
                    <Input
                      id={`max-${q.id}`}
                      type="number"
                      value={q.scaleMax ?? 5}
                      onChange={(e) => patchQuestion(q.id, { scaleMax: Number(e.target.value) })}
                      className="h-8 w-20"
                    />
                  </div>
                </div>
              )}
            </section>
          ))}

          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => set({ questions: [...draft.questions, newQuestion()] })}
          >
            <Plus className="h-3.5 w-3.5" /> Pergunta
          </Button>

          <p className="text-[11px] text-muted-foreground">
            Editar o formulário não encosta nas respostas já dadas. Tirar uma pergunta também não
            apaga o que responderam a ela: a resposta aparece no resumo como “pergunta removida”.
          </p>
        </TabsContent>

        <TabsContent value="respostas" className="mt-3 space-y-3">
          {responseCount === 0 ? (
            <EmptyState
              icon={<Link2 className="h-8 w-8" />}
              title="Nenhuma resposta ainda"
              description="Mande o link para quem precisa responder."
            />
          ) : (
            summary.map((item) => (
              <section
                key={item.questionId}
                className={cn(
                  "rounded-xl border border-border bg-card p-3",
                  item.removed && "border-dashed",
                )}
              >
                <p className="text-sm font-medium">
                  {item.label}
                  {item.removed && (
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      (pergunta removida do formulário)
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">{item.count} resposta(s)</p>

                {item.kind === "numero" && item.count > 0 && (
                  <div className="mt-1 text-sm">
                    <p>
                      Média <span className="font-semibold tabular-nums">{item.average}</span> ·
                      mínimo {item.min} · máximo {item.max}
                    </p>
                    {item.nps && (
                      <p className="text-[11px] text-muted-foreground">
                        NPS {item.nps.score} — {item.nps.promoters} promotor(es),{" "}
                        {item.nps.passives} neutro(s), {item.nps.detractors} detrator(es). Fórmula:
                        % de 9–10 menos % de 0–6.
                      </p>
                    )}
                  </div>
                )}

                {item.kind === "escolha" && (
                  <ul className="mt-1 space-y-1">
                    {item.options.map((option) => (
                      <li key={option.label} className="flex items-center gap-2 text-sm">
                        <span className="w-40 shrink-0 truncate">{option.label}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${option.share}%` }}
                          />
                        </div>
                        <span className="w-16 shrink-0 text-right text-[11px] tabular-nums">
                          {option.count} · {option.share}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {item.kind === "texto" && item.answers.length > 0 && (
                  <ul className="mt-1 divide-y divide-border">
                    {item.answers.map((answer, i) => (
                      <li key={i} className="py-1.5 text-sm">
                        <span className="whitespace-pre-wrap">{answer.value}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {answer.respondent ? `${answer.respondent} · ` : ""}
                          {formatTimestamp(answer.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
