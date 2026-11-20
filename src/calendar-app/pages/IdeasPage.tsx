import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowUpRight,
  Check,
  Lightbulb,
  ListChecks,
  Send,
  ThumbsUp,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  buildIdea,
  countByStatus,
  filterIdeas,
  ideaTitle,
  markUsed,
  parseIdea,
  setStatus,
  tagCloud,
  toggleVote,
  type IdeaFilter,
} from "../ideas";
import type { Idea, IdeaStatus } from "../types";
import { formatShortDay, todayISO } from "../utils";

const STATUS_LABEL: Record<IdeaStatus | "all", string> = {
  all: "Todas",
  nova: "Novas",
  na_pauta: "Na pauta",
  usada: "Usadas",
  arquivada: "Arquivadas",
};

const SCOPE_ALL = "all";
const SCOPE_GERAL = "geral";

/**
 * Banco de ideias de pauta (benchmark ficha 08).
 *
 * Capture is one line: `#etiqueta`, `@menção` and the format come out of the
 * text itself. "Usar ideia" creates the card and keeps the link on both
 * sides — the gap the ficha's own critique points at.
 */
export default function IdeasPage() {
  const navigate = useNavigate();
  const { ideas, clients, calendars, posts, session, saveIdea, deleteIdea, createPost } = useApp();

  const me = useMemo(
    () => ({
      id: session?.email ?? "equipe",
      handle: (session?.name ?? session?.email ?? "equipe").split(/[\s@]/)[0].toLowerCase(),
    }),
    [session],
  );

  const [text, setText] = useState("");
  const [captureScope, setCaptureScope] = useState(SCOPE_GERAL);
  const [filter, setFilter] = useState<IdeaFilter>({ scope: SCOPE_ALL, status: "all" });
  const [using, setUsing] = useState<Idea | null>(null);

  const scoped = useMemo(
    () => ideas.filter((i) => filterIdeas([i], { scope: filter.scope }, me).length > 0),
    [ideas, filter.scope, me],
  );
  const counts = useMemo(() => countByStatus(scoped), [scoped]);
  const visible = useMemo(() => filterIdeas(ideas, filter, me), [ideas, filter, me]);
  const tags = useMemo(() => tagCloud(scoped).slice(0, 12), [scoped]);

  const preview = parseIdea(text);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "cliente";

  async function capture() {
    const idea = buildIdea(
      text,
      me.id,
      captureScope === SCOPE_GERAL ? { kind: "geral" } : { kind: "cliente", clientId: captureScope },
    );
    if (!idea) return toast.error("Escreva a ideia.");
    await saveIdea(idea);
    setText("");
    toast.success("Ideia guardada.");
  }

  const patch = async (next: Idea, message?: string) => {
    await saveIdea(next);
    if (message) toast.success(message);
  };

  return (
    <AdminLayout section="ideias" title="Banco de ideias">
      <header className="mb-4">
        <h1 className="font-display text-xl font-bold sm:text-2xl">Banco de ideias</h1>
        <p className="text-xs text-muted-foreground">
          Escreva em uma linha. <code className="text-foreground">#etiqueta</code> vira etiqueta,{" "}
          <code className="text-foreground">#reels</code> vira formato e{" "}
          <code className="text-foreground">@nome</code> marca alguém.
        </p>
      </header>

      <section className="mb-4 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void capture();
            }}
            placeholder="Ex.: série de bastidores da torra #reels #cafe @bruno"
            aria-label="Nova ideia"
            className="flex-1"
          />
          <Select value={captureScope} onValueChange={setCaptureScope}>
            <SelectTrigger className="w-full sm:w-[190px]" aria-label="Escopo da ideia">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SCOPE_GERAL}>Ideia geral</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void capture()} className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Guardar
          </Button>
        </div>
        {(preview.tags.length > 0 || preview.mentions.length > 0) && (
          <p className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            {preview.format && <Chip>formato: {preview.format}</Chip>}
            {preview.tags.map((t) => (
              <Chip key={t}>#{t}</Chip>
            ))}
            {preview.mentions.map((m) => (
              <Chip key={m}>@{m}</Chip>
            ))}
          </p>
        )}
      </section>

      {/* filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={filter.scope ?? SCOPE_ALL}
          onValueChange={(v) => setFilter((f) => ({ ...f, scope: v }))}
        >
          <SelectTrigger className="h-9 w-[180px]" aria-label="Filtrar por escopo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SCOPE_ALL}>Todas as ideias</SelectItem>
            <SelectItem value={SCOPE_GERAL}>Só as gerais</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-1">
          {(["all", "nova", "na_pauta", "usada", "arquivada"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter((f) => ({ ...f, status: s }))}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                (filter.status ?? "all") === s
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {STATUS_LABEL[s]} <span className="tabular-nums opacity-60">{counts[s]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          <Toggle on={!!filter.mine} onClick={() => setFilter((f) => ({ ...f, mine: !f.mine }))}>
            Minhas
          </Toggle>
          <Toggle
            on={!!filter.mentioningMe}
            onClick={() => setFilter((f) => ({ ...f, mentioningMe: !f.mentioningMe }))}
          >
            Me marcaram
          </Toggle>
          <Toggle
            on={!!filter.votedByMe}
            onClick={() => setFilter((f) => ({ ...f, votedByMe: !f.votedByMe }))}
          >
            Que votei
          </Toggle>
        </div>

        <Input
          value={filter.text ?? ""}
          onChange={(e) => setFilter((f) => ({ ...f, text: e.target.value }))}
          placeholder="Buscar no texto"
          aria-label="Buscar no texto"
          className="h-9 w-full sm:w-[200px]"
        />
      </div>

      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {tags.map(({ tag, count }) => (
            <button
              key={tag}
              type="button"
              onClick={() =>
                setFilter((f) => ({ ...f, tag: f.tag === tag ? undefined : tag }))
              }
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                filter.tag === tag
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              #{tag} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="h-8 w-8" />}
          title="Nenhuma ideia aqui"
          description="Escreva a primeira na linha acima. Ideia solta na cabeça de alguém não vira pauta."
        />
      ) : (
        <ul className="grid gap-2">
          {visible.map((idea) => {
            const mine = idea.votes.includes(me.id);
            const cards = idea.usedBy
              .map((u) => posts.find((p) => p.id === u.postId))
              .filter((p): p is NonNullable<typeof p> => !!p && p.status !== "deleted");
            return (
              <li
                key={idea.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
              >
                <button
                  type="button"
                  onClick={() => void patch(toggleVote(idea, me.id))}
                  aria-label={mine ? "Tirar meu voto" : "Votar nesta ideia"}
                  className={cn(
                    "flex w-11 shrink-0 flex-col items-center rounded-lg border py-1 transition-colors",
                    mine
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold tabular-nums">{idea.votes.length}</span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-sm">{idea.text}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{STATUS_LABEL[idea.status]}</span>
                    <span>·</span>
                    <span>
                      {idea.scope.kind === "geral" ? "geral" : clientName(idea.scope.clientId)}
                    </span>
                    {idea.format && (
                      <>
                        <span>·</span>
                        <span>{idea.format}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatShortDay(idea.createdAt.slice(0, 10))}</span>
                  </p>
                  {cards.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-2 text-[11px]">
                      {cards.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => navigate(`/app/calendars/${p.calendarId}`)}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ArrowUpRight className="h-3 w-3" />
                          {p.title}
                        </button>
                      ))}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  {idea.status !== "na_pauta" && idea.status !== "usada" && (
                    <Action
                      label="Na pauta"
                      icon={<ListChecks className="h-3.5 w-3.5" />}
                      onClick={() => void patch(setStatus(idea, "na_pauta"), "Na pauta.")}
                    />
                  )}
                  <Action
                    label="Usar ideia"
                    icon={<Check className="h-3.5 w-3.5" />}
                    onClick={() => setUsing(idea)}
                  />
                  {idea.status === "arquivada" ? (
                    <Action
                      label="Restaurar"
                      icon={<Undo2 className="h-3.5 w-3.5" />}
                      onClick={() => void patch(setStatus(idea, "nova"), "Restaurada.")}
                    />
                  ) : (
                    <Action
                      label="Arquivar"
                      icon={<Archive className="h-3.5 w-3.5" />}
                      onClick={() => void patch(setStatus(idea, "arquivada"), "Arquivada.")}
                    />
                  )}
                  <Action
                    label="Apagar"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => {
                      if (!window.confirm("Apagar esta ideia? Os cards criados a partir dela ficam.")) return;
                      void deleteIdea(idea.id).then(() => toast.success("Ideia apagada."));
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {using && (
        <UseIdeaDialog
          idea={using}
          onClose={() => setUsing(null)}
          onConfirm={async (calendarId, date) => {
            const post = await createPost({
              calendarId,
              title: ideaTitle(using),
              date,
              description: using.text,
              contentType: using.format,
              ideaId: using.id,
            });
            await saveIdea(markUsed(using, post));
            setUsing(null);
            toast.success("Card criado a partir da ideia.");
          }}
        />
      )}
    </AdminLayout>
  );
}

function UseIdeaDialog({
  idea,
  onClose,
  onConfirm,
}: {
  idea: Idea;
  onClose: () => void;
  onConfirm: (calendarId: string, date: string) => Promise<void>;
}) {
  const { calendars, clients } = useApp();
  const scope = idea.scope;
  const suggested =
    scope.kind === "cliente"
      ? calendars.find((c) => c.clientId === scope.clientId)?.id
      : undefined;
  const [calendarId, setCalendarId] = useState(suggested ?? calendars[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const name = (calId: string) => {
    const cal = calendars.find((c) => c.id === calId);
    return clients.find((c) => c.id === cal?.clientId)?.name ?? cal?.name ?? calId;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Usar ideia</DialogTitle>
        </DialogHeader>
        <p className="rounded-lg bg-foreground/[0.04] p-2 text-sm">{idea.text}</p>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="idea-cal">Calendário</Label>
            <Select value={calendarId} onValueChange={setCalendarId}>
              <SelectTrigger id="idea-cal">
                <SelectValue placeholder="Escolha o cliente" />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {name(c.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="idea-date">Data</Label>
            <Input
              id="idea-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!calendarId || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm(calendarId, date);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Não deu para criar o card.");
                setSaving(false);
              }
            }}
          >
            Criar card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5">{children}</span>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors",
        on
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Action({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={onClick}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
