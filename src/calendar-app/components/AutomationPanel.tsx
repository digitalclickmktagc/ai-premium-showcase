import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  History,
  MinusCircle,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ApprovalResult, PostStatus } from "../types";
import { SELECTABLE_STATUSES, statusConfig } from "../status";
import { formatTimestamp } from "../utils";
import { useApp } from "../store/AppProvider";
import {
  describeAction,
  describeRule,
  describeTrigger,
  presetRules,
  validateRule,
  type AutomationAction,
  type AutomationRun,
  type AutomationTrigger,
} from "../automation";

const RESULTS: { value: ApprovalResult; label: string }[] = [
  { value: "approved", label: "aprovar" },
  { value: "changes", label: "pedir ajuste" },
  { value: "rejected", label: "reprovar" },
];

type TriggerKind = "entered_stage" | "review_decided";
type ActionKind = AutomationAction["type"];

const ACTION_LABEL: Record<ActionKind, string> = {
  move_to_stage: "Mover para uma etapa",
  send_for_review: "Enviar para aprovação do cliente",
  set_due_in_days: "Reagendar em N dias",
};

const RESULT_TONE: Record<AutomationRun["result"], string> = {
  applied: "text-emerald-500",
  skipped: "text-muted-foreground",
  failed: "text-rose-500",
};
const RESULT_ICON: Record<AutomationRun["result"], typeof CheckCircle2> = {
  applied: CheckCircle2,
  skipped: MinusCircle,
  failed: XCircle,
};
const RESULT_WORD: Record<AutomationRun["result"], string> = {
  applied: "aplicada",
  skipped: "ignorada",
  failed: "falhou",
};

/**
 * Stage automations for one calendar (Spec 02 §2).
 *
 * Rules are stored as data, so this screen only has to compose a trigger and
 * an action — adding a rule never means shipping code. The panel starts
 * collapsed because most days nobody needs to look at it.
 */
export default function AutomationPanel({ calendarId }: { calendarId: string }) {
  const { rulesForCalendar, createRule, updateRule, deleteRule, listRuns } = useApp();
  const rules = rulesForCalendar(calendarId);

  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<AutomationRun[] | null>(null);

  // Draft rule being composed.
  const [triggerKind, setTriggerKind] = useState<TriggerKind>("entered_stage");
  const [triggerStage, setTriggerStage] = useState<PostStatus>("done");
  const [triggerResult, setTriggerResult] = useState<ApprovalResult>("approved");
  const [actionKind, setActionKind] = useState<ActionKind>("send_for_review");
  const [actionStage, setActionStage] = useState<PostStatus>("published");
  const [actionDays, setActionDays] = useState("3");

  const active = rules.filter((r) => r.active).length;

  const draft = useMemo(() => {
    const trigger: AutomationTrigger =
      triggerKind === "entered_stage"
        ? { type: "entered_stage", stage: triggerStage }
        : { type: "review_decided", result: triggerResult };
    const action: AutomationAction =
      actionKind === "move_to_stage"
        ? { type: "move_to_stage", stage: actionStage }
        : actionKind === "set_due_in_days"
          ? { type: "set_due_in_days", days: Number(actionDays) }
          : { type: "send_for_review" };
    return { calendarId, trigger, action, active: true };
  }, [
    calendarId,
    triggerKind,
    triggerStage,
    triggerResult,
    actionKind,
    actionStage,
    actionDays,
  ]);

  // Say why a rule cannot be saved while it is being composed, not after.
  const draftError = validateRule(draft);

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await listRuns(calendarId, 20));
    } catch {
      setRuns([]); // the history is nice to have; never block the panel on it
    }
  }, [calendarId, listRuns]);

  useEffect(() => {
    if (open) void loadRuns();
  }, [open, loadRuns, rules.length]);

  const addPresets = async () => {
    const existing = new Set(rules.map((r) => describeRule(r)));
    const missing = presetRules(calendarId).filter(
      (p) => !existing.has(`${describeTrigger(p.trigger)} → ${describeAction(p.action)}`),
    );
    if (missing.length === 0) {
      toast.info("As automações sugeridas já estão criadas.");
      return;
    }
    setBusy(true);
    try {
      for (const preset of missing) await createRule(preset);
      toast.success(
        missing.length === 1
          ? "1 automação sugerida criada."
          : `${missing.length} automações sugeridas criadas.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (draftError) {
      toast.error(draftError);
      return;
    }
    setBusy(true);
    try {
      await createRule(draft);
      setComposing(false);
      toast.success("Automação criada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string, next: boolean) => {
    try {
      await updateRule(id, { active: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar.");
    }
  };

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Remover a automação "${label}"? O histórico é mantido.`)) return;
    try {
      await deleteRule(id);
      toast.success("Automação removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível remover.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Automações
        </span>
        <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground">
          {active} ativa{active === 1 ? "" : "s"}
          {rules.length > active ? ` · ${rules.length - active} pausada${rules.length - active === 1 ? "" : "s"}` : ""}
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
          {/* Rules */}
          {rules.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma automação. Elas agem quando um post entra numa etapa ou quando o
              cliente responde uma aprovação.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2"
                >
                  <Switch
                    id={`rule-${r.id}`}
                    checked={r.active}
                    onCheckedChange={(v) => void toggle(r.id, v)}
                    aria-label={r.active ? "Pausar automação" : "Ativar automação"}
                  />
                  <Label
                    htmlFor={`rule-${r.id}`}
                    className={cn(
                      "cursor-pointer text-xs font-normal leading-snug",
                      !r.active && "text-muted-foreground line-through",
                    )}
                  >
                    {describeRule(r)}
                  </Label>
                  <button
                    type="button"
                    onClick={() => void remove(r.id, describeRule(r))}
                    aria-label="Remover automação"
                    className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Composer */}
          {composing ? (
            <div className="space-y-2.5 rounded-lg border border-dashed border-border p-2.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Quando</Label>
                  <Select
                    value={triggerKind}
                    onValueChange={(v) => setTriggerKind(v as TriggerKind)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entered_stage">Um post entrar numa etapa</SelectItem>
                      <SelectItem value="review_decided">O cliente responder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {triggerKind === "entered_stage" ? "Etapa" : "Resposta"}
                  </Label>
                  {triggerKind === "entered_stage" ? (
                    <Select
                      value={triggerStage}
                      onValueChange={(v) => setTriggerStage(v as PostStatus)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECTABLE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusConfig(s).label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={triggerResult}
                      onValueChange={(v) => setTriggerResult(v as ApprovalResult)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESULTS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Então</Label>
                  <Select
                    value={actionKind}
                    onValueChange={(v) => setActionKind(v as ActionKind)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_LABEL) as ActionKind[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {ACTION_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {actionKind === "move_to_stage" && (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Etapa destino</Label>
                    <Select
                      value={actionStage}
                      onValueChange={(v) => setActionStage(v as PostStatus)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECTABLE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusConfig(s).label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {actionKind === "set_due_in_days" && (
                  <div className="space-y-1">
                    <Label htmlFor="rule-days" className="text-[11px] text-muted-foreground">
                      Dias a partir de hoje
                    </Label>
                    <Input
                      id="rule-days"
                      type="number"
                      min={0}
                      max={365}
                      value={actionDays}
                      onChange={(e) => setActionDays(e.target.value)}
                      className="h-9"
                    />
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {draftError ? (
                  <span className="inline-flex items-start gap-1.5 text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {draftError}
                  </span>
                ) : (
                  <>
                    Prévia:{" "}
                    <span className="text-foreground">
                      {describeTrigger(draft.trigger)} → {describeAction(draft.action)}
                    </span>
                  </>
                )}
              </p>

              <div className="flex gap-2">
                <Button size="sm" onClick={() => void save()} disabled={busy || !!draftError}>
                  Criar automação
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setComposing(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Nova automação
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => void addPresets()}
                disabled={busy}
              >
                <Sparkles className="h-3.5 w-3.5" /> Usar as sugeridas
              </Button>
            </div>
          )}

          {/* Execution log */}
          {runs && runs.length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Últimas execuções
              </p>
              <ul className="space-y-1">
                {runs.map((run) => {
                  const Icon = RESULT_ICON[run.result];
                  return (
                    <li key={run.id} className="flex items-start gap-1.5 text-[11px]">
                      <Icon
                        className={cn("mt-0.5 h-3 w-3 shrink-0", RESULT_TONE[run.result])}
                      />
                      <span className="text-muted-foreground">
                        {formatTimestamp(run.at)} ·{" "}
                        <span className={RESULT_TONE[run.result]}>
                          {RESULT_WORD[run.result]}
                        </span>
                        {run.detail ? ` — ${run.detail}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
