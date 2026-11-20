import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FolderKanban, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { cn } from "@/lib/utils";
import AdminLayout from "../components/AdminLayout";
import EmptyState from "../components/EmptyState";
import { useApp } from "../store/AppProvider";
import {
  DEFAULT_HEALTH_WEIGHTS,
  HEALTH_LABEL,
  PROJECT_STATUS_LABEL,
  isLate,
  lateCount,
  projectPosts,
  projectProgress,
  projectResult,
  squadClients,
  squadHealth,
  squadProjects,
  validateWeights,
} from "../projects";
import { formatMoney, parseMoney } from "../money";
import type { HealthWeights, Project, ProjectStatus, Squad } from "../types";
import { formatShortDay, todayISO } from "../utils";

const NONE = "__none__";

/**
 * Projetos e squads (benchmark ficha 14).
 *
 * The project is the cost centre, so every card is "resultado" as well as
 * "progresso". Both formulas are printed next to their numbers: the ficha's
 * critique is that its own score is never explained, and a number nobody can
 * explain is a number nobody should act on.
 */
export default function ProjectsPage() {
  const navigate = useNavigate();
  const {
    clients,
    calendars,
    posts,
    entries,
    services,
    projects,
    squads,
    healthWeights,
    saveProject,
    deleteProject,
    saveSquad,
    deleteSquad,
    saveHealthWeights,
  } = useApp();

  const today = todayISO();
  const weights = healthWeights ?? DEFAULT_HEALTH_WEIGHTS;
  const [editing, setEditing] = useState<Project | null>(null);
  const [editingSquad, setEditingSquad] = useState<Squad | null>(null);
  const [filter, setFilter] = useState<ProjectStatus | "todos">("todos");

  const visible = useMemo(
    () => (filter === "todos" ? projects : projects.filter((p) => p.status === filter)),
    [projects, filter],
  );
  const late = lateCount(projects, today);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  const blank = (): Project => ({
    id: crypto.randomUUID(),
    name: "",
    clientId: clients[0]?.id ?? "",
    value: 0,
    status: "ativo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return (
    <AdminLayout section="projetos" title="Projetos">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Projetos e squads</h1>
          <p className="text-xs text-muted-foreground">
            O projeto agrupa o trabalho e é o centro de custo: é por ele que o financeiro
            responde se deu lucro.
          </p>
        </div>
        {late > 0 && (
          <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 px-2.5 py-1 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" /> {late} atrasado(s)
          </span>
        )}
      </header>

      <Tabs defaultValue="projetos">
        <TabsList>
          <TabsTrigger value="projetos" className="gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" /> Projetos
            {projects.length > 0 && (
              <span className="text-muted-foreground">{projects.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="squads" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Squads
            {squads.length > 0 && <span className="text-muted-foreground">{squads.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* ── Projetos ── */}
        <TabsContent value="projetos" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => setEditing(blank())}>
              <Plus className="h-3.5 w-3.5" /> Novo projeto
            </Button>
            <Select value={filter} onValueChange={(v) => setFilter(v as ProjectStatus | "todos")}>
              <SelectTrigger className="h-9 w-[160px]" aria-label="Filtrar por situação">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                {Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-8 w-8" />}
              title="Nenhum projeto aqui"
              description="Um projeto nasce sozinho quando um contrato entra em vigor, e pode ser criado à mão a qualquer momento."
            />
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {visible.map((project) => {
                const progress = projectProgress(project, posts);
                const result = projectResult(entries, project.id);
                const cards = projectPosts(posts, project.id);
                const squad = squads.find((s) => s.id === project.squadId);
                const atraso = isLate(project, today);
                return (
                  <li
                    key={project.id}
                    className={cn(
                      "rounded-xl border border-border bg-card p-3",
                      atraso && "border-amber-500/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setEditing(project)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{project.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {clientName(project.clientId)}
                            {squad && ` · ${squad.name}`}
                            {` · ${PROJECT_STATUS_LABEL[project.status]}`}
                            {project.dueDate && ` · prazo ${formatShortDay(project.dueDate)}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm tabular-nums">
                          {formatMoney(project.value, false)}
                        </span>
                      </div>

                      <div className="mt-2">
                        <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                          <span>
                            {progress.percent === null
                              ? "sem card ainda"
                              : `${progress.done} de ${progress.total} card(s) publicados ou feitos`}
                          </span>
                          <span className="tabular-nums">
                            {progress.percent === null ? "—" : `${progress.percent}%`}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${progress.percent ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Liquidado: {formatMoney(result.revenue, false)} de receita −{" "}
                        {formatMoney(result.cost, false)} de custo ={" "}
                        <span className={cn(result.balance < 0 && "text-destructive")}>
                          {formatMoney(result.balance, false)}
                        </span>
                        {result.margin !== null && ` (${result.margin}% de margem)`}
                      </p>
                    </button>

                    {cards.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 px-2 text-[11px]"
                        onClick={() => navigate(`/app/calendars/${cards[0].calendarId}`)}
                      >
                        ver os cards
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ── Squads ── */}
        <TabsContent value="squads" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() =>
                setEditingSquad({
                  id: crypto.randomUUID(),
                  name: "",
                  members: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Novo squad
            </Button>
          </div>

          <WeightsEditor weights={weights} onSave={saveHealthWeights} />

          {squads.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="Nenhum squad"
              description="Um squad agrupa quem toca os projetos. Os clientes atendidos saem dos projetos — ninguém digita a mesma coisa duas vezes."
            />
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {squads.map((squad) => {
                const health = squadHealth(squad.id, projects, posts, weights, today);
                const own = squadProjects(projects, squad.id);
                const clientIds = squadClients(projects, squad.id);
                return (
                  <li key={squad.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingSquad(squad)}
                        className="min-w-0 text-left"
                      >
                        <p className="truncate text-sm font-medium">{squad.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {squad.lead ? `${squad.lead} · ` : ""}
                          {squad.members.length} pessoa(s) · {own.length} projeto(s) ·{" "}
                          {clientIds.length} cliente(s)
                        </p>
                      </button>
                      <span className="shrink-0 text-right">
                        <span className="block text-lg font-semibold tabular-nums">
                          {health.score === null ? "—" : health.score}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          health
                        </span>
                      </span>
                    </div>

                    <ul className="mt-2 space-y-1">
                      {health.parts.map((part) => (
                        <li key={part.key} className="text-[11px] text-muted-foreground">
                          {HEALTH_LABEL[part.key]}:{" "}
                          {part.value === null ? (
                            <span>sem base ({part.detail}), peso redistribuído</span>
                          ) : (
                            <span>
                              {part.value}% × peso {part.weight} = {part.points} pontos —{" "}
                              {part.detail}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {clientIds.length > 0 && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Atende: {clientIds.map(clientName).join(", ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {editing && (
        <ProjectDialog
          project={editing}
          clients={clients}
          squads={squads}
          services={services}
          calendars={calendars}
          onClose={() => setEditing(null)}
          onSave={async (p) => {
            await saveProject(p);
            setEditing(null);
            toast.success("Projeto salvo.");
          }}
          onDelete={async (id) => {
            if (!window.confirm("Apagar o projeto? Os cards e lançamentos ficam, sem projeto."))
              return;
            await deleteProject(id);
            setEditing(null);
            toast.success("Projeto apagado.");
          }}
        />
      )}

      {editingSquad && (
        <SquadDialog
          squad={editingSquad}
          onClose={() => setEditingSquad(null)}
          onSave={async (s) => {
            await saveSquad(s);
            setEditingSquad(null);
            toast.success("Squad salvo.");
          }}
          onDelete={async (id) => {
            if (!window.confirm("Apagar o squad? Os projetos ficam, sem squad.")) return;
            await deleteSquad(id);
            setEditingSquad(null);
            toast.success("Squad apagado.");
          }}
        />
      )}
    </AdminLayout>
  );
}

function WeightsEditor({
  weights,
  onSave,
}: {
  weights: HealthWeights;
  onSave: (w: HealthWeights) => Promise<void>;
}) {
  const [draft, setDraft] = useState(weights);
  useEffect(() => setDraft(weights), [weights]);
  const problem = validateWeights(draft);

  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pesos do health score
      </p>
      <div className="flex flex-wrap items-end gap-2">
        {(Object.keys(HEALTH_LABEL) as (keyof HealthWeights)[]).map((key) => (
          <div key={key} className="grid gap-1">
            <Label htmlFor={`w-${key}`} className="text-[11px]">
              {HEALTH_LABEL[key]}
            </Label>
            <Input
              id={`w-${key}`}
              type="number"
              min={0}
              max={100}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) || 0 })}
              className="h-9 w-24"
            />
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          disabled={!!problem}
          onClick={async () => {
            await onSave(draft);
            toast.success("Pesos salvos.");
          }}
        >
          Salvar pesos
        </Button>
        {problem && <span className="text-xs text-destructive">{problem}</span>}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        O score é a soma de três componentes, cada um em porcentagem, combinados por estes pesos:
        projetos abertos dentro do prazo, progresso médio dos projetos com card, e cards
        publicados ou feitos. Componente sem base não vira zero — seu peso é redistribuído entre
        os outros, para não punir squad por trabalho que ainda não começou.
      </p>
    </section>
  );
}

function ProjectDialog({
  project,
  clients,
  squads,
  services,
  calendars,
  onClose,
  onSave,
  onDelete,
}: {
  project: Project;
  clients: { id: string; name: string }[];
  squads: Squad[];
  services: { id: string; name: string }[];
  calendars: { id: string; clientId: string }[];
  onClose: () => void;
  onSave: (p: Project) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(project);
  const set = (patch: Partial<Project>) => setDraft((d) => ({ ...d, ...patch }));
  const hasCalendar = calendars.some((c) => c.clientId === draft.clientId);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project.name ? "Projeto" : "Novo projeto"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pj-name">Nome</Label>
            <Input
              id="pj-name"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Gestão de redes — 2026"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pj-client">Cliente</Label>
              <Select value={draft.clientId} onValueChange={(v) => set({ clientId: v })}>
                <SelectTrigger id="pj-client">
                  <SelectValue placeholder="Escolha o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!hasCalendar && draft.clientId && (
                <p className="text-[11px] text-muted-foreground">
                  Este cliente ainda não tem calendário; o progresso fica sem base até existir card.
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pj-squad">Squad</Label>
              <Select
                value={draft.squadId ?? NONE}
                onValueChange={(v) => set({ squadId: v === NONE ? undefined : v })}
              >
                <SelectTrigger id="pj-squad">
                  <SelectValue placeholder="Sem squad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem squad</SelectItem>
                  {squads.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pj-due">Prazo</Label>
              <Input
                id="pj-due"
                type="date"
                value={draft.dueDate ?? ""}
                onChange={(e) => set({ dueDate: e.target.value || undefined })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pj-value">Valor</Label>
              <Input
                id="pj-value"
                defaultValue={draft.value ? formatMoney(draft.value, false) : ""}
                onBlur={(e) => set({ value: parseMoney(e.target.value) ?? 0 })}
                placeholder="R$ 0,00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pj-status">Situação</Label>
              <Select
                value={draft.status}
                onValueChange={(v) => set({ status: v as ProjectStatus })}
              >
                <SelectTrigger id="pj-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pj-service">Serviço do catálogo</Label>
            <Select
              value={draft.serviceId ?? NONE}
              onValueChange={(v) => set({ serviceId: v === NONE ? undefined : v })}
            >
              <SelectTrigger id="pj-service">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pj-notes">Observações</Label>
            <Textarea
              id="pj-notes"
              value={draft.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
              className="min-h-20"
            />
          </div>
          {draft.contractId && (
            <p className="text-[11px] text-muted-foreground">
              Projeto aberto pelo contrato — nasceu quando o contrato entrou em vigor.
            </p>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => void onDelete(draft.id)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar
          </Button>
          <Button onClick={() => void onSave(draft)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SquadDialog({
  squad,
  onClose,
  onSave,
  onDelete,
}: {
  squad: Squad;
  onClose: () => void;
  onSave: (s: Squad) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(squad);
  const set = (patch: Partial<Squad>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{squad.name ? "Squad" : "Novo squad"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sq-name">Nome</Label>
            <Input
              id="sq-name"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Squad Aurora"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sq-lead">Líder</Label>
            <Input
              id="sq-lead"
              value={draft.lead ?? ""}
              onChange={(e) => set({ lead: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sq-members">Pessoas</Label>
            <Input
              id="sq-members"
              defaultValue={draft.members.join(", ")}
              onBlur={(e) =>
                set({
                  members: e.target.value
                    .split(",")
                    .map((m) => m.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Ana, Bruno, Carla"
            />
            <p className="text-[11px] text-muted-foreground">
              Nomes separados por vírgula. São rótulos de quem faz o quê: o app ainda tem um
              login só.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sq-desc">Descrição</Label>
            <Textarea
              id="sq-desc"
              value={draft.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              className="min-h-16"
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => void onDelete(draft.id)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar
          </Button>
          <Button onClick={() => void onSave(draft)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
