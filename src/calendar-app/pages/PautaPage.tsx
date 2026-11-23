import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Copy,
  Lock,
  LockOpen,
  Plus,
  Scale,
  Sparkles,
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
import MonthNavigator from "../components/MonthNavigator";
import AiDialog from "../components/AiDialog";
import { contextSugerirPautas, dossierBrief, readPautaSuggestions } from "../ai";
import { useApp } from "../store/AppProvider";
import {
  FUNNEL_LABEL,
  FUNNEL_STAGES,
  MAX_WEEKS,
  balanceByFunnel,
  balanceByPillar,
  canEditPlan,
  expandWeekly,
  forgetCard,
  markConverted,
  monthItems,
  planFor,
  previousMonth,
  seriesToRemove,
  startPlan,
  sumFunnel,
  sumShares,
  toPostInput,
  validatePlan,
} from "../pauta";
import { formatMoney, parseMoney } from "../money";
import type { FunnelStage, MonthlyPlan, PautaItem, Pillar } from "../types";
import { toDayISO } from "../utils";

/**
 * Pauta única (benchmark ficha 17, F17a).
 *
 * One entity, three views: the month's plan, the pauta itself and the
 * panorama that compares them. When the team decides to produce, the item
 * becomes a card — and from then on it is the card, with the approval flow
 * the app already has, that talks to the client.
 */
export default function PautaPage() {
  const navigate = useNavigate();
  const {
    clients,
    calendars,
    posts,
    plans,
    pautaItems,
    savePlan,
    savePautaItems,
    deletePautaItems,
    createPost,
    dossiers,
    dossierTemplates,
  } = useApp();

  const active = clients.filter((c) => c.status !== "archived");
  const [clientId, setClientId] = useState(active[0]?.id ?? "");
  const [cursor, setCursor] = useState(() => new Date());
  const month = format(cursor, "yyyy-MM");

  useEffect(() => {
    if (!clientId && active[0]) setClientId(active[0].id);
  }, [clientId, active]);

  const plan = useMemo(() => planFor(plans, clientId, month), [plans, clientId, month]);
  const items = useMemo(
    () => monthItems(pautaItems, clientId, month),
    [pautaItems, clientId, month],
  );

  const [editing, setEditing] = useState<PautaItem | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);

  useEffect(() => setPicked(new Set()), [clientId, month]);

  const cardOf = (item: PautaItem) => {
    const post = item.postId ? posts.find((p) => p.id === item.postId) : undefined;
    return post && post.status !== "deleted" ? post : undefined;
  };

  async function startThisMonth() {
    const previous = planFor(plans, clientId, previousMonth(month));
    await savePlan(startPlan(clientId, month, previous));
    toast.success(previous ? "Planejamento aberto com os pilares do mês passado." : "Planejamento aberto.");
  }

  if (active.length === 0) {
    return (
      <AdminLayout section="pauta" title="Pauta">
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Nenhum cliente ainda"
          description="A pauta é de um cliente. Cadastre o primeiro para planejar o mês dele."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout section="pauta" title="Pauta">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Pauta do mês</h1>
          <p className="text-xs text-muted-foreground">
            Um lugar só: o que foi planejado, o que está na pauta e o que já virou card.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="h-9 w-[200px]" aria-label="Cliente">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {active.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MonthNavigator month={cursor} onChange={setCursor} />
        </div>
      </header>

      <Tabs defaultValue="pauta">
        <TabsList>
          <TabsTrigger value="pauta" className="gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> Pauta
            {items.length > 0 && <span className="text-muted-foreground">{items.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="plano" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Planejamento
          </TabsTrigger>
          <TabsTrigger value="equilibrio" className="gap-1.5">
            <Scale className="h-3.5 w-3.5" /> Equilíbrio
          </TabsTrigger>
        </TabsList>

        {/* ── Pauta ── */}
        <TabsContent value="pauta" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() =>
                setEditing({
                  id: crypto.randomUUID(),
                  clientId,
                  date: toDayISO(cursor),
                  kind: "post",
                  title: "",
                  channels: [],
                  status: "ideia",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Nova pauta
            </Button>
            <AiDialog
              action="sugerir_pautas"
              clientId={clientId}
              applyLabel="Criar as pautas"
              context={() =>
                contextSugerirPautas({
                  clientName: clients.find((c) => c.id === clientId)?.name ?? "",
                  month,
                  plan,
                  items,
                  quantity: 6,
                  dossier: {
                    sections: dossierBrief(
                      dossiers.find((d) => d.clientId === clientId),
                      dossierTemplates[0],
                    ),
                  },
                })
              }
              onApply={(text) => {
                const suggestions = readPautaSuggestions(text);
                if (suggestions.length === 0) {
                  toast.error("Não consegui ler pautas nessa resposta. Tente perguntar de novo.");
                  return false;
                }
                const now = new Date().toISOString();
                const fallbackDay = toDayISO(cursor);
                void savePautaItems(
                  suggestions.map((s) => ({
                    id: crypto.randomUUID(),
                    clientId,
                    date: s.data?.startsWith(month) ? s.data : fallbackDay,
                    kind: s.onde === "story" ? "story" : "post",
                    title: s.titulo,
                    channels: [],
                    format: s.formato,
                    briefing: s.briefing,
                    pillarId: plan?.pillars.find(
                      (p) => p.name.toLowerCase() === (s.pilar ?? "").toLowerCase(),
                    )?.id,
                    status: "ideia" as const,
                    createdAt: now,
                    updatedAt: now,
                  })),
                );
                toast.success(
                  `${suggestions.length} pauta(s) criada(s) como ideia. Revise antes de converter em card.`,
                );
                return true;
              }}
            />
            {picked.size > 0 && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConverting(true)}>
                  <CheckCheck className="h-3.5 w-3.5" /> Converter {picked.size} em cards
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive"
                  onClick={async () => {
                    const chosen = items.filter((i) => picked.has(i.id) && !i.postId);
                    if (chosen.length === 0) return toast.error("As escolhidas já viraram card.");
                    if (!window.confirm(`Apagar ${chosen.length} pauta(s)?`)) return;
                    await deletePautaItems(chosen.map((i) => i.id));
                    setPicked(new Set());
                    toast.success("Pautas apagadas.");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Apagar
                </Button>
              </>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              title="Mês sem pauta"
              description="Escreva aqui o que vai ao ar. Quando o time decidir produzir, a pauta vira card com um clique."
            />
          ) : (
            <ul className="grid gap-2">
              {items.map((item) => {
                const card = cardOf(item);
                const lost = item.postId && !card;
                const pillar = plan?.pillars.find((p) => p.id === item.pillarId);
                return (
                  <li
                    key={item.id}
                    className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <Checkbox
                      checked={picked.has(item.id)}
                      onCheckedChange={(on) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(item.id);
                          else next.delete(item.id);
                          return next;
                        })
                      }
                      aria-label={`Selecionar ${item.title}`}
                      className="mt-1"
                    />
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="w-12 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {format(new Date(`${item.date}T12:00:00`), "EEE dd", { locale: ptBR })}
                        </span>
                        <span className="truncate">{item.title}</span>
                      </p>
                      <p className="ml-14 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{item.kind === "story" ? "story" : "feed"}</span>
                        {item.format && <span>· {item.format}</span>}
                        {pillar && <span>· {pillar.name}</span>}
                        {item.funnel && <span>· {FUNNEL_LABEL[item.funnel]}</span>}
                        {item.channels.length > 0 && <span>· {item.channels.join(", ")}</span>}
                        {item.owner && <span>· {item.owner}</span>}
                        {item.seriesId && <span>· repetida</span>}
                      </p>
                    </button>
                    {card ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={() => navigate(`/app/calendars/${card.calendarId}`)}
                      >
                        <Copy className="h-3.5 w-3.5" /> ver card
                      </Button>
                    ) : lost ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={async () => {
                          await savePautaItems([forgetCard(item, item.postId!)]);
                          toast.success("Card apagado: a pauta voltou ao planejamento.");
                        }}
                      >
                        card apagado
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ── Planejamento ── */}
        <TabsContent value="plano" className="mt-4">
          {!plan ? (
            <EmptyState
              icon={<Sparkles className="h-8 w-8" />}
              title="Sem planejamento para este mês"
              description="Abra o mês para registrar metas, objetivos, pilares e foco de funil. Os pilares do mês anterior vêm junto."
              action={<Button onClick={() => void startThisMonth()}>Abrir o mês</Button>}
            />
          ) : (
            <PlanEditor plan={plan} onSave={savePlan} />
          )}
        </TabsContent>

        {/* ── Equilíbrio ── */}
        <TabsContent value="equilibrio" className="mt-4 space-y-4">
          {!plan ? (
            <p className="text-sm text-muted-foreground">
              O panorama compara a pauta com o que o planejamento pediu. Abra o planejamento do mês
              para ver a comparação.
            </p>
          ) : (
            <>
              <Balance title="Por pilar" rows={balanceByPillar(plan, items)} />
              <Balance title="Por etapa do funil" rows={balanceByFunnel(plan, items)} />
              <p className="text-[11px] text-muted-foreground">
                A fatia real é a proporção das {items.length} pauta(s) do mês. O que está sem pilar
                ou sem etapa aparece como linha própria: metade da pauta sem pilar é o achado, não
                algo para diluir na média.
              </p>
            </>
          )}
        </TabsContent>
      </Tabs>

      {editing && (
        <ItemDialog
          item={editing}
          pillars={plan?.pillars ?? []}
          existing={pautaItems}
          onClose={() => setEditing(null)}
          onSave={async (items) => {
            await savePautaItems(items);
            setEditing(null);
            toast.success(items.length > 1 ? `${items.length} pautas salvas.` : "Pauta salva.");
          }}
          onDelete={async (scope) => {
            const gone = seriesToRemove(pautaItems, editing, scope);
            if (gone.length === 0) {
              setEditing(null);
              toast.error("Esta pauta já virou card. Apague o card primeiro.");
              return;
            }
            await deletePautaItems(gone.map((i) => i.id));
            setEditing(null);
            toast.success(gone.length > 1 ? `${gone.length} pautas apagadas.` : "Pauta apagada.");
          }}
        />
      )}

      {converting && (
        <ConvertDialog
          count={items.filter((i) => picked.has(i.id) && !i.postId).length}
          clientId={clientId}
          onClose={() => setConverting(false)}
          onConfirm={async (calendarId) => {
            const chosen = items.filter((i) => picked.has(i.id) && !i.postId);
            const done: PautaItem[] = [];
            for (const item of chosen) {
              const post = await createPost(toPostInput(item, calendarId));
              done.push(markConverted(item, post));
            }
            if (done.length > 0) await savePautaItems(done);
            setConverting(false);
            setPicked(new Set());
            toast.success(`${done.length} card(s) criado(s).`);
          }}
        />
      )}
    </AdminLayout>
  );
}

function Balance({ title, rows }: { title: string; rows: ReturnType<typeof balanceByPillar> }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">Nada definido no planejamento.</p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {row.count} pauta(s) · {row.actual}% de {row.planned}%
                {row.gap !== 0 && (
                  <span className={cn("ml-1", row.gap > 0 ? "text-amber-600" : "text-destructive")}>
                    ({row.gap > 0 ? "+" : ""}
                    {row.gap})
                  </span>
                )}
              </span>
            </div>
            <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
                style={{ width: `${Math.min(100, row.actual)}%` }}
              />
              {row.planned > 0 && (
                <div
                  className="absolute inset-y-0 w-0.5 bg-foreground/60"
                  style={{ left: `${Math.min(100, row.planned)}%` }}
                  title={`planejado: ${row.planned}%`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanEditor({
  plan,
  onSave,
}: {
  plan: MonthlyPlan;
  onSave: (p: MonthlyPlan) => Promise<MonthlyPlan>;
}) {
  const [draft, setDraft] = useState<MonthlyPlan>(plan);
  useEffect(() => setDraft(plan), [plan]);
  const locked = !canEditPlan(draft);
  const problem = validatePlan(draft);
  const set = (patch: Partial<MonthlyPlan>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async (next: MonthlyPlan) => {
    const invalid = validatePlan(next);
    if (invalid) return toast.error(invalid);
    await onSave(next);
    toast.success("Planejamento salvo.");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={locked || !!problem} onClick={() => void save(draft)}>
          Salvar
        </Button>
        {locked ? (
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => void save({ ...draft, status: "rascunho", validatedAt: undefined })}
          >
            <LockOpen className="h-3.5 w-3.5" /> Reabrir
          </Button>
        ) : (
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={!!problem}
            onClick={() =>
              void save({ ...draft, status: "validado", validatedAt: new Date().toISOString() })
            }
          >
            <Lock className="h-3.5 w-3.5" /> Validar e travar
          </Button>
        )}
        {problem && <span className="text-xs text-destructive">{problem}</span>}
        {locked && (
          <span className="text-xs text-muted-foreground">
            Validado — travado até alguém reabrir de propósito.
          </span>
        )}
      </div>

      {/* pilares */}
      <section className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pilares de conteúdo
          </p>
          <span
            className={cn(
              "text-xs tabular-nums",
              draft.pillars.length > 0 && sumShares(draft.pillars) !== 100
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {sumShares(draft.pillars)}% de 100%
          </span>
        </div>
        <ul className="space-y-2">
          {draft.pillars.map((p, idx) => (
            <li key={p.id} className="flex items-center gap-2">
              <Input
                value={p.name}
                disabled={locked}
                aria-label={`Nome do pilar ${idx + 1}`}
                onChange={(e) =>
                  set({
                    pillars: draft.pillars.map((x) =>
                      x.id === p.id ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
                className="h-9 flex-1"
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={p.share}
                disabled={locked}
                aria-label={`Fatia do pilar ${idx + 1}`}
                onChange={(e) =>
                  set({
                    pillars: draft.pillars.map((x) =>
                      x.id === p.id ? { ...x, share: Number(e.target.value) || 0 } : x,
                    ),
                  })
                }
                className="h-9 w-20"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={locked}
                aria-label={`Remover pilar ${idx + 1}`}
                onClick={() => set({ pillars: draft.pillars.filter((x) => x.id !== p.id) })}
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
          disabled={locked}
          onClick={() =>
            set({
              pillars: [
                ...draft.pillars,
                { id: crypto.randomUUID(), name: "", share: 0 } satisfies Pillar,
              ],
            })
          }
        >
          <Plus className="h-3.5 w-3.5" /> Pilar
        </Button>
      </section>

      {/* funil */}
      <section className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Foco do funil
          </p>
          <span
            className={cn(
              "text-xs tabular-nums",
              sumFunnel(draft.funnel) !== 0 && sumFunnel(draft.funnel) !== 100
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {sumFunnel(draft.funnel)}%
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {FUNNEL_STAGES.map((stage) => (
            <div key={stage} className="grid gap-1">
              <Label htmlFor={`fn-${stage}`} className="text-[11px]">
                {FUNNEL_LABEL[stage]}
              </Label>
              <Input
                id={`fn-${stage}`}
                type="number"
                min={0}
                max={100}
                disabled={locked}
                value={draft.funnel[stage] ?? 0}
                onChange={(e) =>
                  set({
                    funnel: { ...draft.funnel, [stage]: Number(e.target.value) || 0 },
                  })
                }
                className="h-9"
              />
            </div>
          ))}
        </div>
      </section>

      {/* metas e objetivos */}
      <section className="grid gap-3 lg:grid-cols-2">
        <ListEditor
          title="Metas do mês"
          locked={locked}
          rows={draft.goals.map((g) => ({
            id: g.id,
            left: g.name,
            right: g.target,
            hint: g.previous ? `mês passado: ${g.previous}` : undefined,
          }))}
          leftLabel="Meta"
          rightLabel="Alvo"
          onChange={(rows) =>
            set({
              goals: rows.map((r) => ({
                id: r.id,
                name: r.left,
                target: r.right,
                previous: draft.goals.find((g) => g.id === r.id)?.previous,
              })),
            })
          }
        />
        <ListEditor
          title="Objetivos e indicadores"
          locked={locked}
          rows={draft.objectives.map((o) => ({ id: o.id, left: o.text, right: o.indicator }))}
          leftLabel="Objetivo"
          rightLabel="Indicador"
          onChange={(rows) =>
            set({ objectives: rows.map((r) => ({ id: r.id, text: r.left, indicator: r.right })) })
          }
        />
      </section>

      {/* ações e fechamento */}
      <section className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ações e campanhas
        </p>
        <ul className="space-y-2">
          {draft.actions.map((a, idx) => (
            <li key={a.id} className="grid gap-2 sm:grid-cols-[1fr,120px,110px,110px,40px]">
              <Input
                value={a.title}
                disabled={locked}
                aria-label={`Ação ${idx + 1}`}
                placeholder="Campanha de dia das mães"
                onChange={(e) =>
                  set({
                    actions: draft.actions.map((x) =>
                      x.id === a.id ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
                className="h-9"
              />
              <Input
                value={a.channel ?? ""}
                disabled={locked}
                aria-label={`Canal da ação ${idx + 1}`}
                placeholder="Canal"
                onChange={(e) =>
                  set({
                    actions: draft.actions.map((x) =>
                      x.id === a.id ? { ...x, channel: e.target.value } : x,
                    ),
                  })
                }
                className="h-9"
              />
              <Input
                type="date"
                value={a.startsOn ?? ""}
                disabled={locked}
                aria-label={`Início da ação ${idx + 1}`}
                onChange={(e) =>
                  set({
                    actions: draft.actions.map((x) =>
                      x.id === a.id ? { ...x, startsOn: e.target.value } : x,
                    ),
                  })
                }
                className="h-9"
              />
              <Input
                defaultValue={a.budget ? formatMoney(a.budget, false) : ""}
                disabled={locked}
                aria-label={`Orçamento da ação ${idx + 1}`}
                placeholder="Orçamento"
                onBlur={(e) =>
                  set({
                    actions: draft.actions.map((x) =>
                      x.id === a.id ? { ...x, budget: parseMoney(e.target.value) ?? undefined } : x,
                    ),
                  })
                }
                className="h-9"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                disabled={locked}
                aria-label={`Remover ação ${idx + 1}`}
                onClick={() => set({ actions: draft.actions.filter((x) => x.id !== a.id) })}
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
          disabled={locked}
          onClick={() =>
            set({ actions: [...draft.actions, { id: crypto.randomUUID(), title: "" }] })
          }
        >
          <Plus className="h-3.5 w-3.5" /> Ação
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <Label htmlFor="fechamento" className="text-xs uppercase tracking-wide text-muted-foreground">
          Fechamento do mês
        </Label>
        <Textarea
          id="fechamento"
          value={draft.closing ?? ""}
          disabled={locked}
          onChange={(e) => set({ closing: e.target.value })}
          placeholder="O que funcionou, o que não funcionou, o que muda no mês que vem."
          className="mt-1.5 min-h-24"
        />
      </section>
    </div>
  );
}

function ListEditor({
  title,
  rows,
  leftLabel,
  rightLabel,
  locked,
  onChange,
}: {
  title: string;
  rows: { id: string; left: string; right: string; hint?: string }[];
  leftLabel: string;
  rightLabel: string;
  locked: boolean;
  onChange: (rows: { id: string; left: string; right: string }[]) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-2">
        {rows.map((row, idx) => (
          <li key={row.id} className="grid gap-2 sm:grid-cols-[1fr,140px,40px]">
            <Input
              value={row.left}
              disabled={locked}
              placeholder={leftLabel}
              aria-label={`${leftLabel} ${idx + 1}`}
              onChange={(e) =>
                onChange(rows.map((r) => (r.id === row.id ? { ...r, left: e.target.value } : r)))
              }
              className="h-9"
            />
            <div>
              <Input
                value={row.right}
                disabled={locked}
                placeholder={rightLabel}
                aria-label={`${rightLabel} ${idx + 1}`}
                onChange={(e) =>
                  onChange(rows.map((r) => (r.id === row.id ? { ...r, right: e.target.value } : r)))
                }
                className="h-9"
              />
              {row.hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{row.hint}</p>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              disabled={locked}
              aria-label={`Remover ${leftLabel.toLowerCase()} ${idx + 1}`}
              onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
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
        disabled={locked}
        onClick={() => onChange([...rows, { id: crypto.randomUUID(), left: "", right: "" }])}
      >
        <Plus className="h-3.5 w-3.5" /> Linha
      </Button>
    </div>
  );
}

function ItemDialog({
  item,
  pillars,
  existing,
  onClose,
  onSave,
  onDelete,
}: {
  item: PautaItem;
  pillars: Pillar[];
  existing: PautaItem[];
  onClose: () => void;
  onSave: (items: PautaItem[]) => Promise<void>;
  onDelete: (scope: "uma" | "proximas") => Promise<void>;
}) {
  const [draft, setDraft] = useState(item);
  const [weeks, setWeeks] = useState(1);
  const isNew = !existing.some((i) => i.id === item.id);
  const set = (patch: Partial<PautaItem>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nova pauta" : "Pauta"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pt-title">Título</Label>
            <Input
              id="pt-title"
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Bastidores da torra"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pt-date">Data</Label>
              <Input
                id="pt-date"
                type="date"
                value={draft.date}
                onChange={(e) => set({ date: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pt-kind">Onde</Label>
              <Select
                value={draft.kind}
                onValueChange={(v) => set({ kind: v as PautaItem["kind"] })}
              >
                <SelectTrigger id="pt-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Feed</SelectItem>
                  <SelectItem value="story">Stories</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pt-format">Formato</Label>
              <Input
                id="pt-format"
                value={draft.format ?? ""}
                onChange={(e) => set({ format: e.target.value })}
                placeholder="reels, carrossel..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pt-owner">Responsável</Label>
              <Input
                id="pt-owner"
                value={draft.owner ?? ""}
                onChange={(e) => set({ owner: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pt-pillar">Pilar</Label>
              <Select
                value={draft.pillarId ?? "__none__"}
                onValueChange={(v) => set({ pillarId: v === "__none__" ? undefined : v })}
              >
                <SelectTrigger id="pt-pillar">
                  <SelectValue placeholder="Sem pilar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem pilar</SelectItem>
                  {pillars.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || "(sem nome)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pt-funnel">Etapa do funil</Label>
              <Select
                value={draft.funnel ?? "__none__"}
                onValueChange={(v) =>
                  set({ funnel: v === "__none__" ? undefined : (v as FunnelStage) })
                }
              >
                <SelectTrigger id="pt-funnel">
                  <SelectValue placeholder="Sem etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem etapa</SelectItem>
                  {FUNNEL_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {FUNNEL_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pt-brief">Briefing</Label>
            <Textarea
              id="pt-brief"
              value={draft.briefing ?? ""}
              onChange={(e) => set({ briefing: e.target.value })}
              className="min-h-20"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pt-caption">Legenda</Label>
            <Textarea
              id="pt-caption"
              value={draft.caption ?? ""}
              onChange={(e) => set({ caption: e.target.value })}
              className="min-h-20"
            />
          </div>
          {isNew && (
            <div className="grid gap-1.5">
              <Label htmlFor="pt-weeks">Repetir por quantas semanas</Label>
              <Input
                id="pt-weeks"
                type="number"
                min={1}
                max={MAX_WEEKS}
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value) || 1)}
              />
              <p className="text-[11px] text-muted-foreground">
                1 é só esta. O máximo é {MAX_WEEKS} semanas.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {!isNew && (
            <>
              <Button variant="ghost" className="text-destructive" onClick={() => void onDelete("uma")}>
                Apagar esta
              </Button>
              {draft.seriesId && (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => void onDelete("proximas")}
                >
                  Apagar as próximas
                </Button>
              )}
            </>
          )}
          <Button
            onClick={() => {
              if (!draft.title.trim()) return toast.error("Dê um título à pauta.");
              void onSave(isNew && weeks > 1 ? expandWeekly(draft, weeks) : [draft]);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({
  count,
  clientId,
  onClose,
  onConfirm,
}: {
  count: number;
  clientId: string;
  onClose: () => void;
  onConfirm: (calendarId: string) => Promise<void>;
}) {
  const { calendars, clients } = useApp();
  const suggested = calendars.find((c) => c.clientId === clientId)?.id;
  const [calendarId, setCalendarId] = useState(suggested ?? calendars[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const name = (calId: string) => {
    const cal = calendars.find((c) => c.id === calId);
    return clients.find((c) => c.id === cal?.clientId)?.name ?? cal?.name ?? calId;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Converter {count} pauta(s) em cards</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="cv-cal">Calendário</Label>
          <Select value={calendarId} onValueChange={setCalendarId}>
            <SelectTrigger id="cv-cal">
              <SelectValue placeholder="Escolha o calendário" />
            </SelectTrigger>
            <SelectContent>
              {calendars.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {name(c.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            O card nasce em A fazer. A aprovação do cliente é a do card — a mesma de sempre, não
            um fluxo separado da pauta.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!calendarId || count === 0 || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm(calendarId);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Não deu para converter.");
                setSaving(false);
              }
            }}
          >
            Converter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
