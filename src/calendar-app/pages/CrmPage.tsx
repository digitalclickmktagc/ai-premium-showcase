import { useCallback, useMemo, useState } from "react";
import { Ban, FileUp, Flame, Plus, Target, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import AdminLayout from "../components/AdminLayout";
import DealDialog from "../components/DealDialog";
import ImportContactsDialog from "../components/ImportContactsDialog";
import BlocklistDialog from "../components/BlocklistDialog";
import EmptyState from "../components/EmptyState";
import { useApp } from "../store/AppProvider";
import { useDragToReschedule } from "../hooks/useDragToReschedule";
import { formatMoney, formatMoneyShort } from "../money";
import {
  TEMPERATURE_COLOR,
  canEnterStage,
  dealIsBlocked,
  dealMonthlyValue,
  defaultStages,
  probabilityOf,
  qualificationScore,
  stagesOf,
  stalled,
  temperatureOf,
  weightedPipeline,
  withoutNextStep,
} from "../crm";
import type { Deal, DealPhase } from "../types";
import { formatShortDay, todayISO } from "../utils";

/**
 * CRM with a prospecting phase (benchmark spec 09).
 *
 * One entity walks both funnels: a prospect and an opportunity are the same
 * business at different temperatures, and two registers of one company is how
 * an agency calls someone twice with two different stories.
 */
export default function CrmPage() {
  const { deals, interactions, crmTasks, blocks, saveDeal } = useApp();
  const stages = useMemo(() => defaultStages(), []);

  const [phase, setPhase] = useState<DealPhase>("oportunidade");
  const [editing, setEditing] = useState<Deal | null | undefined>();
  const [importing, setImporting] = useState(false);
  const [blocklist, setBlocklist] = useState(false);

  const funnel = useMemo(() => stagesOf(stages, phase), [stages, phase]);
  const ofPhase = useMemo(
    () => deals.filter((d) => d.phase === phase),
    [deals, phase],
  );

  const handleDrop = useCallback(
    (deal: Deal, stageId: string) => {
      const stage = stages.find((s) => s.id === stageId);
      if (!stage || stage.id === deal.stageId) return;
      const allowed = canEnterStage(deal, stage);
      if (allowed.ok === false) return toast.error(allowed.reason);

      const status =
        stage.kind === "ganho" ? "ganho" : stage.kind === "perda" ? "perdido" : "aberto";
      if (status === "perdido" && !deal.lossReason) {
        const reason = window.prompt("Por que este negócio foi perdido?");
        if (!reason?.trim()) return;
        void saveDeal({ ...deal, stageId: stage.id, status, lossReason: reason.trim() });
        return;
      }
      void saveDeal({ ...deal, stageId: stage.id, status }).catch((err) =>
        toast.error(err instanceof Error ? err.message : "Não foi possível mover."),
      );
    },
    [stages, saveDeal],
  );

  const { drag, overTarget, startDrag, consumeDragClick, scrollerRef } =
    useDragToReschedule<Deal>({
      enabled: true,
      onDrop: handleDrop,
      targetAttr: "stage",
    });

  const byStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const s of funnel) map.set(s.id, []);
    for (const d of ofPhase) map.get(d.stageId)?.push(d);
    for (const [, list] of map) list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return map;
  }, [funnel, ofPhase]);

  const open = deals.filter((d) => d.status === "aberto");
  const pipeline = useMemo(() => weightedPipeline(deals, stages), [deals, stages]);
  const openValue = open.reduce((sum, d) => sum + dealMonthlyValue(d), 0);
  const noNextStep = useMemo(() => withoutNextStep(deals, crmTasks), [deals, crmTasks]);
  const cold = useMemo(() => stalled(deals, 14, todayISO()), [deals]);

  return (
    <AdminLayout section="crm" title="CRM">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Funil</h1>
          <p className="text-xs text-muted-foreground">
            {open.length} em aberto · {formatMoney(openValue)}/mês em jogo ·{" "}
            <span title="Valor ponderado pela probabilidade de cada etapa">
              {formatMoney(pipeline)}/mês ponderado
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => setImporting(true)}>
            <FileUp className="h-4 w-4" /> Importar contatos
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => setBlocklist(true)}>
            <Ban className="h-4 w-4" /> Bloqueios
            {blocks.length > 0 && <span className="text-muted-foreground">{blocks.length}</span>}
          </Button>
          <Button className="gap-1.5" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Novo negócio
          </Button>
        </div>
      </div>

      {(noNextStep.length > 0 || cold.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {noNextStep.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 px-2.5 py-1 text-[11px] text-amber-600 dark:text-amber-400">
              <Target className="h-3 w-3" /> {noNextStep.length} sem próximo passo
            </span>
          )}
          {cold.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> {cold.length} parado(s) há mais de 14 dias
            </span>
          )}
        </div>
      )}

      <Tabs value={phase} onValueChange={(v) => setPhase(v as DealPhase)}>
        <TabsList className="mb-4">
          <TabsTrigger value="oportunidade" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Oportunidades
            <span className="text-muted-foreground">
              {deals.filter((d) => d.phase === "oportunidade").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="prospeccao" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Prospecção
            <span className="text-muted-foreground">
              {deals.filter((d) => d.phase === "prospeccao").length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={phase}>
          {ofPhase.length === 0 ? (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              title="Nenhum negócio aqui"
              description="Cadastre quem a agência está namorando e acompanhe etapa por etapa."
              action={<Button onClick={() => setEditing(null)}>Novo negócio</Button>}
            />
          ) : (
            <div ref={scrollerRef} className="flex gap-3 overflow-x-auto pb-2">
              {funnel.map((stage) => {
                const items = byStage.get(stage.id) ?? [];
                const value = items.reduce((sum, d) => sum + dealMonthlyValue(d), 0);
                const isTarget = Boolean(drag) && overTarget === stage.id && drag?.item.stageId !== stage.id;
                return (
                  <div
                    key={stage.id}
                    data-stage={stage.id}
                    className={cn(
                      "flex w-[250px] shrink-0 flex-col rounded-xl border border-border bg-card transition-colors",
                      isTarget && "border-primary bg-primary/10 ring-2 ring-inset ring-primary",
                    )}
                  >
                    <div className="border-b border-border px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">{stage.name}</h3>
                        <span className="ml-auto rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground">
                          {items.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {stage.defaultProbability}% · {formatMoneyShort(value)}/mês
                      </p>
                    </div>

                    <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
                      {items.map((deal) => {
                        const score = deal.score ?? qualificationScore(deal);
                        const temp = temperatureOf(score);
                        const blocked = dealIsBlocked(deal, blocks);
                        const dragging = drag?.item.id === deal.id;
                        const lastSeen = deal.lastContactOn;
                        return (
                          <button
                            key={deal.id}
                            type="button"
                            onPointerDown={(e) => startDrag(e, deal)}
                            onClick={() => {
                              if (consumeDragClick()) return;
                              setEditing(deal);
                            }}
                            className={cn(
                              "ec-draggable rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:border-primary/40",
                              dragging && "opacity-40",
                            )}
                            style={{ cursor: dragging ? "grabbing" : "grab" }}
                          >
                            <div className="flex items-start gap-1.5">
                              <p className="min-w-0 flex-1 truncate text-sm font-medium">
                                {deal.name}
                              </p>
                              <span
                                className="mt-0.5 inline-flex items-center gap-0.5 text-[10px]"
                                style={{ color: TEMPERATURE_COLOR[temp] }}
                                title={`Qualificação ${score}/100 — ${temp}`}
                              >
                                <Flame className="h-3 w-3" />
                                {score}
                              </span>
                            </div>
                            {deal.company && (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {deal.company}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                              {dealMonthlyValue(deal) > 0 && (
                                <span className="font-medium text-foreground">
                                  {formatMoneyShort(dealMonthlyValue(deal))}/mês
                                </span>
                              )}
                              <span>{probabilityOf(deal, stages)}%</span>
                              {lastSeen && <span>· {formatShortDay(lastSeen)}</span>}
                              {blocked && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-destructive"
                                  title={`Contato bloqueado: ${blocked.reason ?? "sem motivo"}`}
                                >
                                  <Ban className="h-3 w-3" /> bloqueado
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {items.length === 0 && (
                        <p className="px-1 py-6 text-center text-xs text-muted-foreground/70">
                          Arraste um negócio para cá
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {drag && (
        <div
          className="pointer-events-none fixed z-[60] max-w-[220px] rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-lg"
          style={{ left: drag.x + 12, top: drag.y - 10 }}
        >
          <span className="block truncate">{drag.item.name}</span>
        </div>
      )}

      <DealDialog
        open={editing !== undefined}
        deal={editing ?? null}
        phase={phase}
        onOpenChange={(v) => !v && setEditing(undefined)}
      />
      <ImportContactsDialog open={importing} onOpenChange={setImporting} />
      <BlocklistDialog open={blocklist} onOpenChange={setBlocklist} />
    </AdminLayout>
  );
}
