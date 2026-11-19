import { useEffect, useMemo, useState } from "react";
import { Ban, Flame, MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import type { Deal, DealPhase, Interaction, InteractionKind } from "../types";
import {
  DEFAULT_CRITERIA,
  TEMPERATURE_COLOR,
  cadenceAdvice,
  dealIsBlocked,
  defaultStages,
  promoteToOpportunity,
  qualificationScore,
  stagesOf,
  temperatureOf,
  validateDeal,
} from "../crm";
import { formatMoney, parseMoney } from "../money";
import { formatShortDay, formatTimestamp, todayISO, uid } from "../utils";
import { useApp } from "../store/AppProvider";

const KINDS: { id: InteractionKind; label: string }[] = [
  { id: "ligacao", label: "Ligação" },
  { id: "mensagem", label: "Mensagem" },
  { id: "email", label: "E-mail" },
  { id: "reuniao", label: "Reunião" },
  { id: "nota", label: "Nota" },
];

/** One deal: its data, its people, its history and what to do next. */
export default function DealDialog({
  open,
  deal,
  phase,
  onOpenChange,
}: {
  open: boolean;
  deal: Deal | null;
  phase: DealPhase;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    deals,
    interactions,
    crmTasks,
    blocks,
    session,
    saveDeal,
    deleteDeal,
    addInteraction,
    saveCrmTask,
    saveBlock,
  } = useApp();
  const stages = useMemo(() => defaultStages(), []);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [document, setDocument] = useState("");
  const [segment, setSegment] = useState("");
  const [origin, setOrigin] = useState("");
  const [recurring, setRecurring] = useState("");
  const [oneOff, setOneOff] = useState("");
  const [stageId, setStageId] = useState("");
  const [nextStepOn, setNextStepOn] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [kind, setKind] = useState<InteractionKind>("ligacao");
  const [content, setContent] = useState("");
  const [answered, setAnswered] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = stagesOf(stages, phase)[0];
    setName(deal?.name ?? "");
    setCompany(deal?.company ?? "");
    setDocument(deal?.document ?? "");
    setSegment(deal?.segment ?? "");
    setOrigin(deal?.origin ?? "");
    setRecurring(deal ? formatMoney(deal.recurringValue, false) : "");
    setOneOff(deal ? formatMoney(deal.oneOffValue, false) : "");
    setStageId(deal?.stageId ?? first?.id ?? "");
    setNextStepOn(deal?.nextStepOn ?? "");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setContent("");
    setAnswered(false);
    setTaskTitle("");
    setTaskDue(todayISO());
  }, [open, deal, phase, stages]);

  const history = useMemo(
    () =>
      interactions
        .filter((i) => i.dealId === deal?.id)
        .sort((a, b) => b.at.localeCompare(a.at)),
    [interactions, deal],
  );
  const tasks = useMemo(
    () => crmTasks.filter((t) => t.dealId === deal?.id).sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
    [crmTasks, deal],
  );
  const advice = useMemo(
    () => (deal ? cadenceAdvice(interactions, deal.id) : null),
    [interactions, deal],
  );

  const draft: Deal = {
    id: deal?.id ?? uid("deal"),
    phase: deal?.phase ?? phase,
    stageId,
    name,
    company: company.trim() || undefined,
    document: document.trim() || undefined,
    segment: segment.trim() || undefined,
    origin: origin.trim() || undefined,
    recurringValue: parseMoney(recurring) ?? 0,
    oneOffValue: parseMoney(oneOff) ?? 0,
    nextStepOn: nextStepOn || undefined,
    lastContactOn: deal?.lastContactOn,
    clientId: deal?.clientId,
    proposalId: deal?.proposalId,
    status: deal?.status ?? "aberto",
    lossReason: deal?.lossReason,
    contacts: deal?.contacts ?? [],
    createdAt: deal?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const score = qualificationScore(draft);
  const temp = temperatureOf(score);
  const blocked = dealIsBlocked(draft, blocks);

  const save = async () => {
    const invalid = validateDeal(draft);
    if (invalid) return toast.error(invalid);
    setBusy(true);
    try {
      await saveDeal({ ...draft, score });
      toast.success(deal ? "Negócio salvo." : "Negócio criado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const addContact = async () => {
    if (!contactName.trim()) return toast.error("Informe o nome do contato.");
    const hit =
      blocks.find((b) => b.kind === "email" && b.value === contactEmail.trim().toLowerCase()) ??
      undefined;
    if (hit) return toast.error("Este contato pediu para não ser abordado.");
    await saveDeal({
      ...draft,
      contacts: [
        ...draft.contacts,
        {
          id: uid("ct"),
          name: contactName.trim(),
          email: contactEmail.trim() || undefined,
          phone: contactPhone.trim() || undefined,
          primary: draft.contacts.length === 0,
          // LGPD: where it came from and when, recorded at the moment of entry.
          source: "cadastro manual",
          collectedAt: todayISO(),
          lawfulBasis: "interesse legítimo (prospecção B2B)",
        },
      ],
    });
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    toast.success("Contato adicionado.");
  };

  const log = async () => {
    if (!deal) return toast.error("Salve o negócio antes de registrar interações.");
    if (!content.trim()) return toast.error("Escreva o que aconteceu.");
    const entry: Interaction = {
      id: uid("int"),
      dealId: deal.id,
      kind,
      at: new Date().toISOString(),
      author: session?.name,
      content: content.trim(),
      answered: kind === "nota" ? undefined : answered,
    };
    await addInteraction(entry);
    setContent("");
    setAnswered(false);
    toast.success("Interação registrada.");
  };

  const addTask = async () => {
    if (!deal) return toast.error("Salve o negócio antes de criar tarefas.");
    if (!taskTitle.trim()) return toast.error("Dê um título à tarefa.");
    await saveCrmTask({ id: uid("task"), dealId: deal.id, title: taskTitle.trim(), dueOn: taskDue });
    setTaskTitle("");
    toast.success("Tarefa criada.");
  };

  const block = async () => {
    const email = draft.contacts.find((c) => c.email)?.email;
    if (!email) return toast.error("Este negócio não tem e-mail para bloquear.");
    const reason = window.prompt("Por que bloquear este contato?") ?? "";
    if (!reason.trim()) return;
    await saveBlock({
      id: uid("blk"),
      kind: "email",
      value: email.toLowerCase(),
      reason: reason.trim(),
      at: new Date().toISOString(),
    });
    toast.success("Contato bloqueado. Ele não entra mais por importação.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate font-display text-lg">
              {deal ? deal.name : "Novo negócio"}
            </DialogTitle>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1" style={{ color: TEMPERATURE_COLOR[temp] }}>
                <Flame className="h-3 w-3" /> {score}/100 · {temp}
              </span>
              {blocked && (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <Ban className="h-3 w-3" /> contato bloqueado
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Tabs defaultValue="dados">
            <TabsList>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="contatos">
                Contatos <span className="ml-1 text-muted-foreground">{draft.contacts.length}</span>
              </TabsTrigger>
              <TabsTrigger value="historico">
                Histórico <span className="ml-1 text-muted-foreground">{history.length}</span>
              </TabsTrigger>
              <TabsTrigger value="tarefas">
                Tarefas <span className="ml-1 text-muted-foreground">{tasks.length}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="deal-name">Nome *</Label>
                  <Input id="deal-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deal-company">Empresa</Label>
                  <Input
                    id="deal-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deal-doc">CNPJ / CPF</Label>
                  <Input
                    id="deal-doc"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deal-segment">Segmento</Label>
                  <Input
                    id="deal-segment"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deal-rec">Valor recorrente</Label>
                  <Input
                    id="deal-rec"
                    value={recurring}
                    onChange={(e) => setRecurring(e.target.value)}
                    placeholder="1.500,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deal-one">Valor único</Label>
                  <Input
                    id="deal-one"
                    value={oneOff}
                    onChange={(e) => setOneOff(e.target.value)}
                    placeholder="2.400,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Etapa</Label>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger aria-label="Etapa">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stagesOf(stages, draft.phase).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deal-next">Próximo passo em</Label>
                  <Input
                    id="deal-next"
                    type="date"
                    value={nextStepOn}
                    onChange={(e) => setNextStepOn(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Qualificação
                </p>
                <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
                  {DEFAULT_CRITERIA.map((c) => (
                    <li
                      key={c.key}
                      className={cn(
                        "text-[11px]",
                        c.met(draft) ? "text-foreground" : "text-muted-foreground line-through",
                      )}
                    >
                      {c.met(draft) ? "✓" : "·"} {c.label} ({c.weight})
                    </li>
                  ))}
                </ul>
              </div>

              {deal && deal.phase === "prospeccao" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void saveDeal(promoteToOpportunity(deal, stages)).then(() => {
                      toast.success("Promovido para oportunidade.");
                      onOpenChange(false);
                    })
                  }
                >
                  Promover para oportunidade
                </Button>
              )}
            </TabsContent>

            <TabsContent value="contatos" className="mt-4 space-y-3">
              <ul className="space-y-1.5">
                {draft.contacts.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border px-2.5 py-2">
                    <p className="text-sm font-medium">
                      {c.name}
                      {c.primary && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">principal</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {[c.email, c.phone].filter(Boolean).join(" · ")}
                    </p>
                    {c.collectedAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Coletado em {formatShortDay(c.collectedAt)} · {c.lawfulBasis}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nome"
                  aria-label="Nome do contato"
                  className="h-9"
                />
                <Input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="E-mail"
                  aria-label="E-mail do contato"
                  className="h-9"
                />
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Telefone"
                  aria-label="Telefone do contato"
                  className="h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addContact} disabled={!deal && !name}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar contato
                </Button>
                {deal && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={block}>
                    <Ban className="mr-1 h-3.5 w-3.5" /> Não contatar
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Todo contato guarda de onde veio, quando foi coletado e sob que base legal.
              </p>
            </TabsContent>

            <TabsContent value="historico" className="mt-4 space-y-3">
              {advice && advice.attempts > 0 && (
                <div
                  className={cn(
                    "rounded-lg border p-2.5 text-xs",
                    advice.giveUp
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border bg-muted",
                  )}
                >
                  {advice.giveUp ? (
                    <>
                      <strong>{advice.attempts} tentativas sem resposta.</strong> A regra sugere
                      marcar como perdido por “sem resposta” — mas quem decide é você.
                    </>
                  ) : (
                    <>
                      {advice.attempts} tentativa(s) sem resposta. Próxima em{" "}
                      <strong>{formatShortDay(advice.nextOn!)}</strong>.
                    </>
                  )}
                </div>
              )}

              <div className="space-y-2 rounded-lg border border-border p-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {KINDS.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setKind(k.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                        kind === k.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={2}
                  placeholder="O que aconteceu?"
                  aria-label="Conteúdo da interação"
                />
                <div className="flex items-center gap-3">
                  {kind !== "nota" && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={answered}
                        onChange={(e) => setAnswered(e.target.checked)}
                      />
                      A pessoa respondeu
                    </label>
                  )}
                  <Button size="sm" className="ml-auto" onClick={log}>
                    <MessageSquare className="mr-1 h-3.5 w-3.5" /> Registrar
                  </Button>
                </div>
              </div>

              <ul className="space-y-1.5">
                {history.map((i) => (
                  <li key={i.id} className="rounded-lg border border-border bg-muted p-2.5">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        {KINDS.find((k) => k.id === i.kind)?.label}
                      </span>
                      {i.answered && <span className="text-emerald-500">respondeu</span>}
                      <span className="ml-auto">{formatTimestamp(i.at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{i.content}</p>
                  </li>
                ))}
                {history.length === 0 && (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    Nenhuma interação registrada. Uma interação nunca é editada — corrigir é
                    registrar outra.
                  </p>
                )}
              </ul>
            </TabsContent>

            <TabsContent value="tarefas" className="mt-4 space-y-3">
              <ul className="space-y-1.5">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(t.doneAt)}
                      onChange={() =>
                        void saveCrmTask({
                          ...t,
                          doneAt: t.doneAt ? undefined : new Date().toISOString(),
                        })
                      }
                      aria-label={`Concluir ${t.title}`}
                    />
                    <span className={cn("flex-1 text-sm", t.doneAt && "line-through opacity-60")}>
                      {t.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatShortDay(t.dueOn)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ligar para o Zé"
                  aria-label="Título da tarefa"
                  className="h-9"
                />
                <Input
                  type="date"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  aria-label="Data da tarefa"
                  className="h-9"
                />
                <Button size="sm" variant="outline" onClick={addTask}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {deal && (
            <Button
              variant="ghost"
              className="gap-1.5 text-rose-400 hover:bg-rose-500/10"
              onClick={() => {
                if (!window.confirm(`Excluir "${deal.name}"? O histórico vai junto.`)) return;
                void deleteDeal(deal.id).then(() => {
                  toast.success("Negócio excluído.");
                  onOpenChange(false);
                });
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Fechar
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
