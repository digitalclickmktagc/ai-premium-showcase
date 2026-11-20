import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Lock,
  LockOpen,
  Plus,
  Radar,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useApp } from "../store/AppProvider";
import {
  MAX_COMPETITORS,
  canAddCompetitor,
  canEdit,
  competitors,
  defaultTemplate,
  gaps,
  newQuestion,
  newSubject,
  scoreAll,
  startAssessment,
  toDossierRows,
  toDossierText,
  validateTemplate,
} from "../assessment";
import { sectionOf, setSection } from "../dossier";
import type { Assessment, AssessmentTemplate } from "../types";

/**
 * Análise de perfil e de concorrência (benchmark ficha 17, F17d).
 *
 * The formula is printed next to the number, the bands that turn a score
 * into a verdict are the agency's to edit, and a finished analysis is pushed
 * into the dossier instead of becoming a second, divergent truth.
 */
export default function AssessmentPage() {
  const {
    clients,
    assessmentTemplates,
    assessments,
    dossiers,
    dossierTemplates,
    saveAssessmentTemplate,
    saveAssessment,
    deleteAssessment,
    saveDossier,
  } = useApp();

  const template = assessmentTemplates[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = assessments.find((a) => a.id === selectedId) ?? assessments[0];

  if (clients.length === 0) {
    return (
      <AdminLayout section="analise" title="Análise">
        <EmptyState
          icon={<Radar className="h-8 w-8" />}
          title="Nenhum cliente ainda"
          description="A análise compara o perfil de um cliente com os concorrentes dele."
        />
      </AdminLayout>
    );
  }

  if (!template) {
    return (
      <AdminLayout section="analise" title="Análise">
        <EmptyState
          icon={<ClipboardCheck className="h-8 w-8" />}
          title="Monte o modelo de análise"
          description="Critérios, pesos e faixas são seus. Comece pelo padrão e mude o que quiser."
          action={
            <Button
              onClick={async () => {
                await saveAssessmentTemplate(defaultTemplate());
                toast.success("Modelo criado.");
              }}
            >
              Criar o modelo padrão
            </Button>
          }
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout section="analise" title="Análise">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Análise de perfil</h1>
          <p className="text-xs text-muted-foreground">
            O cliente e até {MAX_COMPETITORS} concorrentes, nota a nota, com a conta à vista.
          </p>
        </div>
        <Select
          onValueChange={async (clientId) => {
            const client = clients.find((c) => c.id === clientId);
            if (!client) return;
            const created = startAssessment(clientId, client.name, template.id);
            await saveAssessment(created);
            setSelectedId(created.id);
            toast.success("Análise criada.");
          }}
        >
          <SelectTrigger className="h-9 w-[210px]" aria-label="Nova análise para">
            <SelectValue placeholder="Nova análise para..." />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <Tabs defaultValue="analises">
        <TabsList>
          <TabsTrigger value="analises" className="gap-1.5">
            <Radar className="h-3.5 w-3.5" /> Análises
            {assessments.length > 0 && (
              <span className="text-muted-foreground">{assessments.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="modelo" className="gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" /> Critérios e faixas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analises" className="mt-4">
          {!selected ? (
            <EmptyState
              icon={<Radar className="h-8 w-8" />}
              title="Nenhuma análise ainda"
              description="Escolha um cliente acima para começar."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-[200px,1fr]">
              <ul className="space-y-1">
                {assessments.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                        a.id === selected.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-foreground/[0.03]",
                      )}
                    >
                      <span className="block truncate text-sm">{a.title}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {a.status === "concluida" ? "concluída" : "em andamento"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <AssessmentEditor
                key={selected.id}
                assessment={selected}
                template={template}
                onSave={saveAssessment}
                onDelete={async () => {
                  if (!window.confirm("Apagar esta análise?")) return;
                  await deleteAssessment(selected.id);
                  setSelectedId(null);
                  toast.success("Análise apagada.");
                }}
                onToDossier={async () => {
                  const dossier = dossiers.find((d) => d.clientId === selected.clientId);
                  const dossierTemplate = dossierTemplates[0];
                  if (!dossier || !dossierTemplate) {
                    toast.error("Abra o dossiê deste cliente primeiro.");
                    return;
                  }
                  const raiox = dossierTemplate.sections.find((s) => s.kind === "campos" && s.id === "raiox");
                  const concorrentes = dossierTemplate.sections.find((s) => s.id === "concorrentes");
                  let next = dossier;
                  if (raiox) {
                    const current = sectionOf(dossier, raiox);
                    next = setSection(next, {
                      ...current,
                      values: {
                        ...(current.values ?? {}),
                        veredito: toDossierText(selected, template),
                      },
                    });
                  }
                  if (concorrentes) {
                    const current = sectionOf(next, concorrentes);
                    next = setSection(next, { ...current, rows: toDossierRows(selected) });
                  }
                  if (next === dossier) {
                    toast.error("O modelo do dossiê não tem as seções de raio-X e concorrentes.");
                    return;
                  }
                  await saveDossier(next);
                  toast.success("Análise levada para o dossiê.");
                }}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="modelo" className="mt-4">
          <TemplateEditor template={template} onSave={saveAssessmentTemplate} />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function AssessmentEditor({
  assessment,
  template,
  onSave,
  onDelete,
  onToDossier,
}: {
  assessment: Assessment;
  template: AssessmentTemplate;
  onSave: (a: Assessment) => Promise<Assessment>;
  onDelete: () => Promise<void>;
  onToDossier: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(assessment);
  useEffect(() => setDraft(assessment), [assessment]);
  const editable = canEdit(draft);
  const scores = useMemo(() => scoreAll(draft, template), [draft, template]);
  const behind = useMemo(() => gaps(draft, template).filter((g) => g.behind > 0), [draft, template]);
  const groups = useMemo(
    () => [...new Set(template.questions.map((q) => q.group))],
    [template],
  );

  const set = (patch: Partial<Assessment>) => setDraft((d) => ({ ...d, ...patch }));
  const rate = (subjectId: string, questionId: string, value: number) =>
    set({
      scores: {
        ...draft.scores,
        [subjectId]: { ...(draft.scores[subjectId] ?? {}), [questionId]: value },
      },
    });

  const save = async (patch: Partial<Assessment> = {}) => {
    const next = { ...draft, ...patch };
    try {
      await onSave(next);
      setDraft(next);
      toast.success("Análise salva.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu para salvar.");
    }
  };

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Input
          value={draft.title}
          disabled={!editable}
          onChange={(e) => set({ title: e.target.value })}
          aria-label="Nome da análise"
          className="h-9 min-w-[10rem] flex-1"
        />
        <Button disabled={!editable} onClick={() => void save()}>
          Salvar
        </Button>
        {editable ? (
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => void save({ status: "concluida", concludedAt: new Date().toISOString() })}
          >
            <Lock className="h-3.5 w-3.5" /> Concluir
          </Button>
        ) : (
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => void save({ status: "em_andamento", concludedAt: undefined })}
          >
            <LockOpen className="h-3.5 w-3.5" /> Reabrir
          </Button>
        )}
        <Button variant="outline" className="gap-1.5" onClick={() => void onToDossier()}>
          <BookOpen className="h-3.5 w-3.5" /> Levar ao dossiê
        </Button>
        <Button variant="ghost" className="ml-auto text-destructive" onClick={() => void onDelete()}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </section>

      {/* Placar */}
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {scores.map((s) => (
          <div
            key={s.subjectId}
            className={cn(
              "rounded-xl border bg-card p-3",
              s.kind === "cliente" ? "border-primary/40" : "border-border",
            )}
          >
            <p className="truncate text-sm font-medium">{s.name}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {s.score === null ? "—" : s.score}
              {s.score !== null && <span className="text-sm font-normal">/100</span>}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {s.band ?? "sem nota"} · {s.answered} de {s.total} critérios
            </p>
          </div>
        ))}
      </section>

      {behind.length > 0 && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Onde perdemos hoje
          </p>
          <ul className="space-y-0.5 text-sm">
            {behind.map((gap) => (
              <li key={gap.group}>
                {gap.group}: {gap.ours} contra {gap.theirs} de {gap.leader}{" "}
                <span className="text-[11px] text-muted-foreground">(−{gap.behind})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Perfis comparados */}
      <section className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Perfis comparados
        </p>
        <ul className="space-y-2">
          {draft.subjects.map((subject, index) => (
            <li key={subject.id} className="grid gap-2 sm:grid-cols-[1fr,140px,120px,140px,40px]">
              <Input
                value={subject.name}
                disabled={!editable}
                aria-label={`Nome do perfil ${index + 1}`}
                onChange={(e) =>
                  set({
                    subjects: draft.subjects.map((s) =>
                      s.id === subject.id ? { ...s, name: e.target.value } : s,
                    ),
                  })
                }
                className="h-9"
              />
              <Input
                value={subject.handle ?? ""}
                disabled={!editable}
                placeholder="@perfil"
                aria-label={`Perfil social ${index + 1}`}
                onChange={(e) =>
                  set({
                    subjects: draft.subjects.map((s) =>
                      s.id === subject.id ? { ...s, handle: e.target.value } : s,
                    ),
                  })
                }
                className="h-9"
              />
              <Input
                type="number"
                min={0}
                value={subject.followers ?? ""}
                disabled={!editable}
                placeholder="seguidores"
                aria-label={`Seguidores ${index + 1}`}
                onChange={(e) =>
                  set({
                    subjects: draft.subjects.map((s) =>
                      s.id === subject.id
                        ? { ...s, followers: Number(e.target.value) || undefined }
                        : s,
                    ),
                  })
                }
                className="h-9"
              />
              <Input
                value={subject.frequency ?? ""}
                disabled={!editable}
                placeholder="frequência"
                aria-label={`Frequência ${index + 1}`}
                onChange={(e) =>
                  set({
                    subjects: draft.subjects.map((s) =>
                      s.id === subject.id ? { ...s, frequency: e.target.value } : s,
                    ),
                  })
                }
                className="h-9"
              />
              {subject.kind === "concorrente" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  disabled={!editable}
                  aria-label={`Remover perfil ${index + 1}`}
                  onClick={() =>
                    set({ subjects: draft.subjects.filter((s) => s.id !== subject.id) })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <span className="self-center text-[11px] text-muted-foreground">cliente</span>
              )}
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 gap-1.5"
          disabled={!editable || !canAddCompetitor(draft)}
          onClick={() => set({ subjects: [...draft.subjects, newSubject()] })}
        >
          <Plus className="h-3.5 w-3.5" /> Concorrente
        </Button>
        {!canAddCompetitor(draft) && (
          <span className="ml-2 text-[11px] text-muted-foreground">
            {MAX_COMPETITORS} é o teto — comparação maior do que isso ninguém lê.
          </span>
        )}
      </section>

      {/* Notas */}
      {groups.map((group) => (
        <section key={group} className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 pr-3">Critério</th>
                  <th className="py-1 pr-3">Peso</th>
                  {draft.subjects.map((s) => (
                    <th key={s.id} className="py-1 pr-3">
                      {s.name || "—"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {template.questions
                  .filter((q) => q.group === group)
                  .map((question) => (
                    <tr key={question.id} className="border-t border-border/60">
                      <td className="py-1.5 pr-3">{question.label}</td>
                      <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
                        {question.weight}
                      </td>
                      {draft.subjects.map((subject) => (
                        <td key={subject.id} className="py-1.5 pr-3">
                          <div className="flex gap-0.5">
                            {[0, 1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                disabled={!editable}
                                aria-label={`${subject.name}: ${question.label} nota ${n}`}
                                onClick={() => rate(subject.id, question.id, n)}
                                className={cn(
                                  "h-6 w-6 rounded border text-[11px] tabular-nums transition-colors",
                                  draft.scores[subject.id]?.[question.id] === n
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border hover:bg-foreground/[0.05]",
                                )}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-border bg-card p-3">
        <Label htmlFor="an-conclusions" className="text-xs uppercase tracking-wide text-muted-foreground">
          Conclusões
        </Label>
        <Textarea
          id="an-conclusions"
          value={draft.conclusions ?? ""}
          disabled={!editable}
          onChange={(e) => set({ conclusions: e.target.value })}
          placeholder="O que fazer primeiro, e por quê."
          className="mt-1.5 min-h-24"
        />
      </section>

      <p className="text-[11px] text-muted-foreground">
        A nota é média ponderada das notas 0–5, normalizada para 0–100. Critério não avaliado fica
        fora da média em vez de valer zero: não ter olhado não é a mesma coisa que estar ruim.
      </p>
    </div>
  );
}

function TemplateEditor({
  template,
  onSave,
}: {
  template: AssessmentTemplate;
  onSave: (t: AssessmentTemplate) => Promise<AssessmentTemplate>;
}) {
  const [draft, setDraft] = useState(template);
  useEffect(() => setDraft(template), [template]);
  const problem = validateTemplate(draft);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          aria-label="Nome do modelo de análise"
          className="h-9 w-56"
        />
        <Button
          disabled={!!problem}
          onClick={async () => {
            await onSave(draft);
            toast.success("Modelo salvo.");
          }}
        >
          Salvar modelo
        </Button>
        {problem && <span className="text-xs text-destructive">{problem}</span>}
      </div>

      <section className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Faixas (o que a nota quer dizer)
        </p>
        <ul className="space-y-1.5">
          {draft.bands.map((band, index) => (
            <li key={index} className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={band.min}
                aria-label={`Nota mínima da faixa ${index + 1}`}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    bands: draft.bands.map((b, i) =>
                      i === index ? { ...b, min: Number(e.target.value) || 0 } : b,
                    ),
                  })
                }
                className="h-9 w-20"
              />
              <Input
                value={band.label}
                aria-label={`Nome da faixa ${index + 1}`}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    bands: draft.bands.map((b, i) =>
                      i === index ? { ...b, label: e.target.value } : b,
                    ),
                  })
                }
                className="h-9 max-w-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label={`Remover faixa ${index + 1}`}
                onClick={() =>
                  setDraft({ ...draft, bands: draft.bands.filter((_, i) => i !== index) })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 gap-1.5"
          onClick={() => setDraft({ ...draft, bands: [...draft.bands, { min: 0, label: "" }] })}
        >
          <Plus className="h-3.5 w-3.5" /> Faixa
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          A ficha do benchmark diz que existem faixas, mas não quais. Estas são suas: a faixa mais
          baixa precisa começar em 0, senão uma nota fica sem veredito.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Critérios e pesos
        </p>
        <ul className="space-y-1.5">
          {draft.questions.map((question, index) => (
            <li key={question.id} className="grid gap-2 sm:grid-cols-[140px,1fr,90px,40px]">
              <Input
                value={question.group}
                aria-label={`Grupo do critério ${index + 1}`}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    questions: draft.questions.map((q) =>
                      q.id === question.id ? { ...q, group: e.target.value } : q,
                    ),
                  })
                }
                className="h-9"
              />
              <Input
                value={question.label}
                aria-label={`Enunciado do critério ${index + 1}`}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    questions: draft.questions.map((q) =>
                      q.id === question.id ? { ...q, label: e.target.value } : q,
                    ),
                  })
                }
                className="h-9"
              />
              <Input
                type="number"
                min={1}
                value={question.weight}
                aria-label={`Peso do critério ${index + 1}`}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    questions: draft.questions.map((q) =>
                      q.id === question.id ? { ...q, weight: Number(e.target.value) || 1 } : q,
                    ),
                  })
                }
                className="h-9"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label={`Remover critério ${index + 1}`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    questions: draft.questions.filter((q) => q.id !== question.id),
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 gap-1.5"
          onClick={() => setDraft({ ...draft, questions: [...draft.questions, newQuestion()] })}
        >
          <Plus className="h-3.5 w-3.5" /> Critério
        </Button>
      </section>
    </div>
  );
}
