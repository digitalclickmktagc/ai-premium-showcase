import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Billing, PaymentMethod, Proposal, ProposalItem } from "../types";
import {
  BILLING_LABEL,
  defaultValidUntil,
  isEditable,
  itemFromService,
  itemTotal,
  proposalTotals,
  validatePaymentTerms,
} from "../proposals";
import { formatMoney, installmentPlanLabel, parseMoney } from "../money";
import { installmentPlan } from "../proposals";
import { shareToken, uid } from "../utils";
import { useApp } from "../store/AppProvider";

const BILLINGS: Billing[] = ["mensal", "trimestral", "semestral", "anual", "unica", "por_hora"];
const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "boleto", label: "Boleto" },
  { id: "cartao", label: "Cartão" },
  { id: "transferencia", label: "Transferência" },
];
const NO_CLIENT = "__lead__";

/** Build or edit a proposal (spec 06 §4.2). */
export default function ProposalEditor({
  open,
  proposal,
  onOpenChange,
}: {
  open: boolean;
  proposal: Proposal | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { clients, services, saveProposal } = useApp();
  const readOnly = proposal ? !isEditable(proposal) : false;

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string>(NO_CLIENT);
  const [leadName, setLeadName] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [minMonths, setMinMonths] = useState("");
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [modality, setModality] = useState<"a_vista" | "parcelado">("a_vista");
  const [entry, setEntry] = useState("");
  const [installments, setInstallments] = useState("3");
  const [methods, setMethods] = useState<PaymentMethod[]>(["pix"]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(proposal?.title ?? "");
    setClientId(proposal?.clientId ?? NO_CLIENT);
    setLeadName(proposal?.leadName ?? "");
    setValidUntil(proposal?.validUntil ?? defaultValidUntil());
    setMinMonths(proposal?.minMonths ? String(proposal.minMonths) : "");
    setConditions(proposal?.conditions ?? "");
    setNotes(proposal?.notes ?? "");
    setItems(proposal?.items ?? []);
    setModality(proposal?.payment?.modality ?? "a_vista");
    setEntry(proposal?.payment ? formatMoney(proposal.payment.entryAmount, false) : "");
    setInstallments(String(proposal?.payment?.installments ?? 3));
    setMethods(proposal?.payment?.methods ?? ["pix"]);
  }, [open, proposal]);

  const totals = useMemo(() => proposalTotals(items), [items]);
  const entryCents = parseMoney(entry) ?? 0;
  const plan = useMemo(
    () =>
      installmentPlan(
        { modality, entryAmount: entryCents, installments: Number(installments) || 0, methods },
        totals.oneOff,
      ),
    [modality, entryCents, installments, methods, totals.oneOff],
  );

  const addItem = (fromService?: string) => {
    const svc = services.find((s) => s.id === fromService);
    const base = svc
      ? itemFromService(svc)
      : {
          description: "",
          quantity: 1,
          unitPrice: 0,
          billing: "mensal" as Billing,
        };
    setItems((list) => [...list, { ...base, id: uid("item") }]);
  };

  const patchItem = (id: string, patch: Partial<ProposalItem>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const save = async () => {
    const payment = {
      modality,
      entryAmount: entryCents,
      installments: Number(installments) || 0,
      methods,
    };
    if (totals.oneOff > 0) {
      const invalid = validatePaymentTerms(payment, totals.oneOff);
      if (invalid) return toast.error(invalid);
    }

    const next: Proposal = {
      id: proposal?.id ?? uid("prop"),
      number: proposal?.number,
      title,
      clientId: clientId === NO_CLIENT ? undefined : clientId,
      leadName: clientId === NO_CLIENT ? leadName.trim() || undefined : undefined,
      validUntil,
      minMonths: minMonths ? Number(minMonths) : undefined,
      conditions: conditions.trim() || undefined,
      notes: notes.trim() || undefined,
      status: proposal?.status ?? "rascunho",
      linkId: proposal?.linkId ?? shareToken(),
      items,
      payment: totals.oneOff > 0 ? payment : undefined,
      views: proposal?.views ?? [],
      sentAt: proposal?.sentAt,
      decidedAt: proposal?.decidedAt,
      deciderName: proposal?.deciderName,
      deciderDocument: proposal?.deciderDocument,
      refusalReason: proposal?.refusalReason,
      version: proposal?.version ?? 1,
      createdAt: proposal?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setBusy(true);
    try {
      await saveProposal(next);
      toast.success(proposal ? "Proposta salva." : "Rascunho criado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="font-display text-lg">
            {proposal ? proposal.title || "Proposta" : "Nova proposta"}
          </DialogTitle>
          {readOnly && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Proposta aceita: é o registro do que foi combinado e não muda mais.
            </p>
          )}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <fieldset disabled={readOnly} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prop-title">Título *</Label>
                <Input
                  id="prop-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Gestão de redes — Aurora Café"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Para quem *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CLIENT}>Alguém que ainda não é cliente</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {clientId === NO_CLIENT && (
              <div className="space-y-1.5">
                <Label htmlFor="prop-lead">Nome de quem recebe *</Label>
                <Input
                  id="prop-lead"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Padaria do Zé"
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prop-valid">Vale até *</Label>
                <Input
                  id="prop-valid"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prop-min">Prazo mínimo (meses)</Label>
                <Input
                  id="prop-min"
                  type="number"
                  min={0}
                  value={minMonths}
                  onChange={(e) => setMinMonths(e.target.value)}
                  placeholder="sem mínimo"
                />
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label>Itens</Label>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  {services
                    .filter((s) => s.active)
                    .slice(0, 6)
                    .map((s) => (
                      <Button
                        key={s.id}
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-[11px]"
                        onClick={() => addItem(s.id)}
                      >
                        <Package className="h-3 w-3" /> {s.name}
                      </Button>
                    ))}
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => addItem()}>
                    <Plus className="h-3 w-3" /> Item livre
                  </Button>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  Puxe um serviço do catálogo ou escreva um item livre.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item.id} className="rounded-lg border border-border p-2.5">
                      <div className="grid gap-2 sm:grid-cols-[1fr_72px_120px_130px_auto]">
                        <Input
                          value={item.description}
                          onChange={(e) => patchItem(item.id, { description: e.target.value })}
                          placeholder="Descrição"
                          aria-label="Descrição do item"
                          className="h-9"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            patchItem(item.id, { quantity: Number(e.target.value) || 1 })
                          }
                          aria-label="Quantidade"
                          className="h-9"
                        />
                        <Input
                          defaultValue={formatMoney(item.unitPrice, false)}
                          key={`${item.id}-price`}
                          onBlur={(e) => {
                            const cents = parseMoney(e.target.value);
                            if (cents === null) {
                              toast.error("Preço inválido.");
                              return;
                            }
                            patchItem(item.id, { unitPrice: cents });
                          }}
                          aria-label="Preço unitário"
                          className="h-9"
                        />
                        <Select
                          value={item.billing}
                          onValueChange={(v) => patchItem(item.id, { billing: v as Billing })}
                        >
                          <SelectTrigger className="h-9" aria-label="Cobrança do item">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BILLINGS.map((b) => (
                              <SelectItem key={b} value={b}>
                                {BILLING_LABEL[b]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          aria-label="Remover item"
                          onClick={() => setItems((l) => l.filter((i) => i.id !== item.id))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="mt-1 text-right text-[11px] text-muted-foreground">
                        {formatMoney(itemTotal(item))} {BILLING_LABEL[item.billing]}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Totais */}
            <div className="grid gap-3 rounded-xl border border-border bg-muted p-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Recorrente
                </p>
                <p className="text-lg font-semibold">
                  {formatMoney(totals.recurringMonthly)}
                  <span className="text-xs font-normal text-muted-foreground">/mês</span>
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Único</p>
                <p className="text-lg font-semibold">{formatMoney(totals.oneOff)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Primeiro ano
                </p>
                <p className="text-lg font-semibold">{formatMoney(totals.firstYear)}</p>
              </div>
            </div>

            {/* Condições de pagamento — só fazem sentido com valor único */}
            {totals.oneOff > 0 && (
              <div className="space-y-3">
                <Label>Condições do valor único</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select
                    value={modality}
                    onValueChange={(v) => setModality(v as "a_vista" | "parcelado")}
                  >
                    <SelectTrigger aria-label="Modalidade">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_vista">À vista</SelectItem>
                      <SelectItem value="parcelado">Parcelado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder="Entrada (opcional)"
                    aria-label="Entrada"
                  />
                  {modality === "parcelado" && (
                    <Input
                      type="number"
                      min={2}
                      max={60}
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                      aria-label="Número de parcelas"
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setMethods((list) =>
                          list.includes(m.id)
                            ? list.filter((x) => x !== m.id)
                            : [...list, m.id],
                        )
                      }
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                        methods.includes(m.id)
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {plan.length > 0 && (
                  <p className="text-xs text-muted-foreground">{installmentPlanLabel(plan)}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="prop-cond">Condições</Label>
              <Textarea
                id="prop-cond"
                rows={2}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Prazo de execução, o que o cliente precisa fornecer..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prop-notes">Observações</Label>
              <Textarea
                id="prop-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </fieldset>

          {proposal?.views.length ? (
            <p className="text-xs text-muted-foreground">
              Aberta {proposal.views.length} vez(es). Última em{" "}
              {new Date(proposal.views[proposal.views.length - 1].at).toLocaleString("pt-BR")}.
            </p>
          ) : null}
          {proposal?.refusalReason && (
            <p className="rounded-lg border border-border bg-muted p-2.5 text-xs">
              <strong>Resposta do cliente:</strong> {proposal.refusalReason}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Fechar
          </Button>
          {!readOnly && (
            <Button onClick={save} disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
