import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2,
  FileText,
  FileX2,
  Loader2,
  MessageSquareWarning,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Proposal } from "../types";
import { getDataService } from "../services";
import {
  BILLING_LABEL,
  daysToExpiry,
  installmentPlan,
  isExpired,
  itemTotal,
  proposalTotals,
} from "../proposals";
import { formatMoney, installmentPlanLabel } from "../money";
import { formatLongDay } from "../utils";
import EmptyState from "../components/EmptyState";

type Decision = "aceita" | "ajuste_pedido" | "recusada";

const OPTIONS: { result: Decision; label: string; icon: typeof CheckCircle2; className: string }[] =
  [
    { result: "aceita", label: "Aceitar", icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
    { result: "ajuste_pedido", label: "Pedir ajuste", icon: MessageSquareWarning, className: "text-amber-600 dark:text-amber-400" },
    { result: "recusada", label: "Recusar", icon: XCircle, className: "text-rose-600 dark:text-rose-400" },
  ];

/**
 * The client's view of a proposal (spec 06 §4.4).
 *
 * Recurring and one-off are shown apart all the way down: they are different
 * promises, and a single blended number is how a deal ends up disputed.
 * Internal notes never cross over — the public payload simply does not carry
 * them.
 */
export default function PublicProposalPage() {
  const { linkId = "" } = useParams();
  const service = useMemo(() => getDataService(), []);

  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [result, setResult] = useState<Decision | null>(null);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProposal(await service.getPublicProposal(linkId));
    } catch {
      setProposal(null);
    } finally {
      setLoading(false);
    }
  }, [service, linkId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => proposalTotals(proposal?.items ?? []), [proposal]);
  const plan = useMemo(
    () => (proposal?.payment ? installmentPlan(proposal.payment, totals.oneOff) : []),
    [proposal, totals.oneOff],
  );

  const submit = async () => {
    if (!result || !proposal) return;
    setBusy(true);
    try {
      await service.decideProposal(linkId, {
        result,
        deciderName: name,
        deciderDocument: document,
        reason,
      });
      toast.success(
        result === "aceita" ? "Proposta aceita. Obrigado!" : "Resposta registrada. Obrigado!",
      );
      setResult(null);
      setReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="ce-app flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="ce-app flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <EmptyState
          icon={<FileX2 className="h-10 w-10" />}
          title="Proposta indisponível"
          description="Este link não está mais válido. Peça um novo à agência."
        />
      </div>
    );
  }

  const expired = isExpired(proposal);
  const decided = ["aceita", "recusada", "ajuste_pedido"].includes(proposal.status);
  const days = daysToExpiry(proposal);

  return (
    <div className="ce-app min-h-[100dvh] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-4 w-4" />
            {proposal.number && <span>Proposta {proposal.number}</span>}
            {proposal.version > 1 && <span>· versão {proposal.version}</span>}
          </div>
          <h1 className="font-display text-2xl font-bold">{proposal.title}</h1>
          <p className="text-sm text-muted-foreground">
            {expired ? (
              <span className="text-destructive">
                Venceu em {formatLongDay(proposal.validUntil)}.
              </span>
            ) : (
              <>
                Vale até {formatLongDay(proposal.validUntil)}
                {days <= 7 && days >= 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {" "}· {days === 0 ? "vence hoje" : `faltam ${days} dia(s)`}
                  </span>
                )}
              </>
            )}
          </p>
        </header>

        {/* Escopo */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            O que está incluso
          </h2>
          <ul className="space-y-3">
            {proposal.items.map((item) => (
              <li key={item.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {item.quantity > 1 && (
                      <span className="text-muted-foreground">{item.quantity}× </span>
                    )}
                    {item.description}
                  </p>
                  <p className="text-sm">
                    {formatMoney(itemTotal(item))}{" "}
                    <span className="text-xs text-muted-foreground">
                      {BILLING_LABEL[item.billing]}
                    </span>
                  </p>
                </div>
                {item.scope && (
                  <ul className="mt-1 space-y-0.5">
                    {item.scope.split("\n").filter(Boolean).map((line, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        · {line}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Investimento */}
        <section className="grid gap-3 sm:grid-cols-2">
          {totals.recurringMonthly > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Mensalidade
              </p>
              <p className="text-2xl font-bold">
                {formatMoney(totals.recurringMonthly)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              {proposal.minMonths ? (
                <p className="text-xs text-muted-foreground">
                  Compromisso mínimo de {proposal.minMonths} meses.
                </p>
              ) : null}
            </div>
          )}
          {totals.oneOff > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Valor único
              </p>
              <p className="text-2xl font-bold">{formatMoney(totals.oneOff)}</p>
              {plan.length > 0 ? (
                <p className="text-xs text-muted-foreground">{installmentPlanLabel(plan)}</p>
              ) : null}
              {proposal.payment && proposal.payment.entryAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Entrada de {formatMoney(proposal.payment.entryAmount)}.
                </p>
              )}
            </div>
          )}
        </section>

        {proposal.conditions && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Condições
            </h2>
            <p className="whitespace-pre-wrap text-sm">{proposal.conditions}</p>
          </section>
        )}

        {/* Decisão */}
        {decided ? (
          <section
            className={cn(
              "rounded-xl border p-4 text-center",
              proposal.status === "aceita"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border bg-card",
            )}
          >
            <p className="font-medium">
              {proposal.status === "aceita" && "Proposta aceita. A agência entra em contato."}
              {proposal.status === "recusada" && "Você recusou esta proposta."}
              {proposal.status === "ajuste_pedido" &&
                "Pedido de ajuste registrado. A agência vai mandar uma nova versão."}
            </p>
            {proposal.deciderName && (
              <p className="mt-1 text-xs text-muted-foreground">
                Registrado por {proposal.deciderName}
                {proposal.decidedAt &&
                  ` em ${new Date(proposal.decidedAt).toLocaleString("pt-BR")}`}
              </p>
            )}
          </section>
        ) : expired ? (
          <section className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            Esta proposta venceu. Peça uma nova à agência — os valores podem ter mudado.
          </section>
        ) : (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap gap-2">
              {OPTIONS.map((o) => {
                const Icon = o.icon;
                return (
                  <Button
                    key={o.result}
                    variant="outline"
                    size="sm"
                    onClick={() => setResult(result === o.result ? null : o.result)}
                    className={cn("gap-1.5", o.className, result === o.result && "ring-2 ring-primary")}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {o.label}
                  </Button>
                );
              })}
            </div>

            {result && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dec-name">Seu nome *</Label>
                    <Input id="dec-name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dec-doc">CPF ou CNPJ</Label>
                    <Input
                      id="dec-doc"
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dec-reason">
                    {result === "aceita" ? "Quer deixar um recado? (opcional)" : "O que precisa mudar? *"}
                  </Label>
                  <Textarea
                    id="dec-reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <Button onClick={submit} disabled={busy} className="w-full">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
