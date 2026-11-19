import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Workflow,
  Eye,
  FileSignature,
  FileText,
  Package,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import AdminLayout from "../components/AdminLayout";
import ProposalEditor from "../components/ProposalEditor";
import ContractEditor from "../components/ContractEditor";
import ServiceEditor from "../components/ServiceEditor";
import EmptyState from "../components/EmptyState";
import { useApp } from "../store/AppProvider";
import { formatMoney } from "../money";
import {
  BILLING_LABEL,
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_LABEL,
  expiringSoon,
  isExpired,
  proposalTotals,
} from "../proposals";
import {
  CONTRACT_STATUS_COLOR,
  CONTRACT_STATUS_LABEL,
  deriveStatus,
  needsRenewalNotice,
  pendingParties,
} from "../contracts";
import { formatShortDay, shareUrl, todayISO } from "../utils";
import { STEP_LABEL, failedStep, progressOf } from "../orchestrator";
import type { Proposal, Service } from "../types";

/**
 * Commercial area: catalogue, proposals and contracts (specs 06 and 07).
 *
 * One page with three tabs rather than three pages: for a small agency these
 * are three views of the same conversation with one client, and splitting
 * them would mean three navigations for one piece of work.
 */
export default function CommercialPage() {
  const {
    services,
    proposals,
    contracts,
    clients,
    processes,
    deleteService,
    sendProposal,
    deleteProposal,
    retryProcess,
  } = useApp();

  const [tab, setTab] = useState("propostas");
  const [search, setSearch] = useState("");
  const [editingProposal, setEditingProposal] = useState<Proposal | null | undefined>();
  const [editingService, setEditingService] = useState<Service | null | undefined>();
  const [contractFor, setContractFor] = useState<string | null | undefined>();

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name;

  const visibleProposals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proposals
      .filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          p.number?.toLowerCase().includes(q) ||
          clientName(p.clientId)?.toLowerCase().includes(q) ||
          p.leadName?.toLowerCase().includes(q),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposals, search, clients]);

  /** Headline figures the spec asks for: open value, win rate, expiring. */
  const indicators = useMemo(() => {
    const open = proposals.filter((p) => p.status === "enviada");
    const decided = proposals.filter((p) => p.status === "aceita" || p.status === "recusada");
    const won = decided.filter((p) => p.status === "aceita");
    const openValue = open.reduce((sum, p) => {
      const t = proposalTotals(p.items);
      return sum + t.oneOff + t.recurringMonthly;
    }, 0);
    return {
      openValue,
      openCount: open.length,
      winRate: decided.length === 0 ? null : Math.round((won.length / decided.length) * 100),
      expiring: open.filter((p) => expiringSoon(p)).length,
    };
  }, [proposals]);

  const removeProposal = async (p: Proposal) => {
    if (!window.confirm(`Excluir "${p.title}"?`)) return;
    try {
      await deleteProposal(p.id);
      toast.success("Proposta excluída.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  };

  const send = async (p: Proposal) => {
    try {
      const sent = await sendProposal(p.id);
      toast.success(`Proposta ${sent.number} pronta para enviar.`, {
        description: "Copie o link e mande ao cliente.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar.");
    }
  };

  return (
    <AdminLayout section="comercial" title="Comercial">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Comercial</h1>
          <p className="text-xs text-muted-foreground">
            {formatMoney(indicators.openValue)} em {indicators.openCount} proposta(s) aberta(s)
            {indicators.winRate !== null && ` · ${indicators.winRate}% de aceite`}
            {indicators.expiring > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {" "}· {indicators.expiring} vence(m) em breve
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "catalogo" && (
            <Button className="gap-1.5" onClick={() => setEditingService(null)}>
              <Plus className="h-4 w-4" /> Novo serviço
            </Button>
          )}
          {tab === "propostas" && (
            <Button className="gap-1.5" onClick={() => setEditingProposal(null)}>
              <Plus className="h-4 w-4" /> Nova proposta
            </Button>
          )}
          {tab === "contratos" && (
            <Button className="gap-1.5" onClick={() => setContractFor(null)}>
              <Plus className="h-4 w-4" /> Novo contrato
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="propostas" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Propostas
            <span className="text-muted-foreground">{proposals.length}</span>
          </TabsTrigger>
          <TabsTrigger value="contratos" className="gap-1.5">
            <FileSignature className="h-3.5 w-3.5" /> Contratos
            <span className="text-muted-foreground">{contracts.length}</span>
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Catálogo
            <span className="text-muted-foreground">{services.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Propostas ── */}
        <TabsContent value="propostas" className="mt-4 space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, número ou cliente"
            className="h-9 max-w-sm"
          />
          {visibleProposals.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="Nenhuma proposta"
              description="Monte uma a partir do catálogo e mande o link para o cliente."
              action={<Button onClick={() => setEditingProposal(null)}>Nova proposta</Button>}
            />
          ) : (
            <ul className="space-y-2">
              {visibleProposals.map((p) => {
                const totals = proposalTotals(p.items);
                const process = processes.find((x) => x.proposalId === p.id);
                const expired = isExpired(p);
                const status = expired ? "vencida" : p.status;
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: PROPOSAL_STATUS_COLOR[status] }}
                      title={PROPOSAL_STATUS_LABEL[status]}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingProposal(p)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium">
                        {p.number && (
                          <span className="mr-1.5 text-muted-foreground">{p.number}</span>
                        )}
                        {p.title}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {clientName(p.clientId) ?? p.leadName} · vale até{" "}
                        {formatShortDay(p.validUntil)}
                        {p.views.length > 0 && ` · ${p.views.length} abertura(s)`}
                        {p.version > 1 && ` · v${p.version}`}
                      </p>
                    </button>

                    <div className="text-right text-xs">
                      {totals.recurringMonthly > 0 && (
                        <p className="font-medium">
                          {formatMoney(totals.recurringMonthly)}
                          <span className="text-muted-foreground">/mês</span>
                        </p>
                      )}
                      {totals.oneOff > 0 && (
                        <p className="text-muted-foreground">
                          {formatMoney(totals.oneOff)} único
                        </p>
                      )}
                    </div>

                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${PROPOSAL_STATUS_COLOR[status]}22`,
                        color: PROPOSAL_STATUS_COLOR[status],
                      }}
                    >
                      {PROPOSAL_STATUS_LABEL[status]}
                    </span>

                    <div className="flex shrink-0 items-center gap-1">
                      {(p.status === "rascunho" ||
                        p.status === "ajuste_pedido" ||
                        p.status === "vencida") && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => send(p)}>
                          <Send className="h-3.5 w-3.5" /> Enviar
                        </Button>
                      )}
                      {p.status !== "rascunho" && p.status !== "arquivada" && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Copiar link do cliente"
                            onClick={() => {
                              void navigator.clipboard.writeText(shareUrl(p.linkId, "/p"));
                              toast.success("Link copiado.");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Ver como o cliente vê"
                            asChild
                          >
                            <a href={shareUrl(p.linkId, "/p")} target="_blank" rel="noreferrer">
                              <Eye className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </>
                      )}
                      {p.status === "aceita" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setContractFor(p.id)}
                        >
                          <FileSignature className="h-3.5 w-3.5" /> Contrato
                        </Button>
                      )}
                      {(p.status === "rascunho" || p.status === "arquivada") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Excluir"
                          onClick={() => removeProposal(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {process && (
                      <div className="w-full border-t border-border pt-2">
                        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Workflow className="h-3 w-3" />
                          Contratação: {progressOf(process).done}/{progressOf(process).total} passos
                          {process.status === "aguardando_assinatura" && (
                            <span className="text-amber-600 dark:text-amber-400">
                              · aguardando assinaturas (nada financeiro foi criado ainda)
                            </span>
                          )}
                          {process.status === "concluido" && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              · concluída
                            </span>
                          )}
                          {process.status === "falhou" && (
                            <span className="text-destructive">
                              · parou em “{STEP_LABEL[failedStep(process)!.key]}”:{" "}
                              {failedStep(process)?.detail}
                            </span>
                          )}
                          {process.status === "falhou" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px]"
                              onClick={() =>
                                void retryProcess(process.id).catch((err) =>
                                  toast.error(
                                    err instanceof Error ? err.message : "Não foi possível.",
                                  ),
                                )
                              }
                            >
                              Tentar de novo
                            </Button>
                          )}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ── Contratos ── */}
        <TabsContent value="contratos" className="mt-4 space-y-3">
          {contracts.length === 0 ? (
            <EmptyState
              icon={<FileSignature className="h-10 w-10" />}
              title="Nenhum contrato"
              description="Aceite uma proposta e gere o contrato a partir dela, ou comece um do zero."
              action={<Button onClick={() => setContractFor(null)}>Novo contrato</Button>}
            />
          ) : (
            <ul className="space-y-2">
              {contracts.map((c) => {
                const status = deriveStatus(c);
                const pending = pendingParties(c);
                const renewing = needsRenewalNotice(c, todayISO());
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: CONTRACT_STATUS_COLOR[status] }}
                    />
                    <button
                      type="button"
                      onClick={() => setContractFor(c.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {clientName(c.clientId) ?? "sem cliente"} ·{" "}
                        {c.signatures.length}/{c.parties.filter((p) => p.required).length}{" "}
                        assinatura(s)
                        {pending.length > 0 && ` · falta ${pending[0].name}`}
                        {c.endsOn && ` · até ${formatShortDay(c.endsOn)}`}
                      </p>
                    </button>
                    {renewing && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> a renovar
                      </span>
                    )}
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${CONTRACT_STATUS_COLOR[status]}22`,
                        color: CONTRACT_STATUS_COLOR[status],
                      }}
                    >
                      {CONTRACT_STATUS_LABEL[status]}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ── Catálogo ── */}
        <TabsContent value="catalogo" className="mt-4 space-y-3">
          {services.length === 0 ? (
            <EmptyState
              icon={<Package className="h-10 w-10" />}
              title="Catálogo vazio"
              description="Cadastre o que a agência vende para montar propostas em um clique."
              action={<Button onClick={() => setEditingService(null)}>Novo serviço</Button>}
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {[...services]
                .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
                .map((s) => (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border border-border bg-card p-3",
                      !s.active && "opacity-60",
                    )}
                  >
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color ?? "#8b5cf6" }}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingService(s)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatMoney(s.price)} {BILLING_LABEL[s.billing]}
                        {s.category && ` · ${s.category}`}
                        {!s.active && " · inativo"}
                      </p>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Excluir serviço"
                      onClick={() => {
                        if (!window.confirm(`Excluir "${s.name}"? As propostas já feitas não mudam.`))
                          return;
                        void deleteService(s.id).catch((err) =>
                          toast.error(err instanceof Error ? err.message : "Falhou."),
                        );
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <ProposalEditor
        open={editingProposal !== undefined}
        proposal={editingProposal ?? null}
        onOpenChange={(v) => !v && setEditingProposal(undefined)}
      />
      <ServiceEditor
        open={editingService !== undefined}
        service={editingService ?? null}
        onOpenChange={(v) => !v && setEditingService(undefined)}
      />
      <ContractEditor
        open={contractFor !== undefined}
        contractOrProposalId={contractFor ?? null}
        onOpenChange={(v) => !v && setContractFor(undefined)}
      />
    </AdminLayout>
  );
}
