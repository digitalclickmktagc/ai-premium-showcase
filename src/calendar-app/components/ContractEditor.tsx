import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Contract, ContractParty, PartyRole } from "../types";
import {
  CONTRACT_STATUS_LABEL,
  DEFAULT_RENEW_NOTICE_DAYS,
  PARTY_ROLE_LABEL,
  canEditText,
  deriveStatus,
  evidenceSummary,
  hashText,
  hasSigned,
  missingVariables,
  renderTemplate,
  validateParties,
} from "../contracts";
import { BILLING_LABEL, proposalTotals } from "../proposals";
import { formatMoney } from "../money";
import { shareToken, shareUrl, todayISO, uid } from "../utils";
import { useApp } from "../store/AppProvider";

const ROLES: PartyRole[] = ["contratante", "contratada", "testemunha"];

/** A plain, readable starting point. The agency edits it before generating. */
const DEFAULT_TEMPLATE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: {{cliente.nome}}, inscrito(a) sob o documento {{cliente.documento}}.
CONTRATADA: {{agencia.nome}}, inscrita sob o documento {{agencia.documento}}.

1. OBJETO
A CONTRATADA prestará à CONTRATANTE os seguintes serviços:
{{servicos}}

2. VALORES
Valor recorrente: {{valor.recorrente}} por mês.
Valor único: {{valor.unico}}.

3. VIGÊNCIA
Início em {{vigencia.inicio}}, término em {{vigencia.fim}}.

4. OBRIGAÇÕES DA CONTRATADA
Executar os serviços descritos com zelo, dentro dos prazos combinados, e manter
sigilo sobre as informações da CONTRATANTE.

5. OBRIGAÇÕES DA CONTRATANTE
Fornecer, em tempo hábil, as informações e aprovações necessárias à execução.

6. RESCISÃO
Qualquer das partes pode rescindir mediante aviso de 30 (trinta) dias.

Brasília, {{hoje}}.`;

/**
 * Generate and track one contract (spec 07).
 *
 * Generating freezes the text and its SHA-256. From the first signature on,
 * neither can change — enforced here, in the adapter and by a database
 * trigger, because this hash is the entire evidentiary weight of a simple
 * electronic signature.
 */
export default function ContractEditor({
  open,
  contractOrProposalId,
  onOpenChange,
}: {
  open: boolean;
  /** An existing contract id, or a proposal id to generate from. */
  contractOrProposalId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { contracts, proposals, clients, session, saveContract, deleteContract } = useApp();

  const existing = contracts.find((c) => c.id === contractOrProposalId);
  const fromProposal = proposals.find((p) => p.id === contractOrProposalId);

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [body, setBody] = useState(DEFAULT_TEMPLATE);
  const [startsOn, setStartsOn] = useState(todayISO());
  const [endsOn, setEndsOn] = useState("");
  const [autoRenew, setAutoRenew] = useState(true);
  const [parties, setParties] = useState<ContractParty[]>([]);
  const [busy, setBusy] = useState(false);

  const locked = existing ? !canEditText(existing) : false;

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitle(existing.title);
      setClientId(existing.clientId ?? "");
      setBody(existing.finalText);
      setStartsOn(existing.startsOn ?? todayISO());
      setEndsOn(existing.endsOn ?? "");
      setAutoRenew(existing.autoRenew);
      setParties(existing.parties);
      return;
    }
    const client = clients.find((c) => c.id === fromProposal?.clientId);
    setTitle(fromProposal ? `Contrato — ${fromProposal.title}` : "Novo contrato");
    setClientId(fromProposal?.clientId ?? "");
    setBody(DEFAULT_TEMPLATE);
    setStartsOn(todayISO());
    setEndsOn("");
    setAutoRenew(true);
    setParties([
      newParty("contratante", client?.name ?? fromProposal?.leadName ?? "", 0, true),
      newParty("contratada", session?.name ?? "Digital Click", 1, true),
      newParty("testemunha", "", 2, false),
      newParty("testemunha", "", 3, false),
    ]);
  }, [open, existing, fromProposal, clients, session]);

  const vars = useMemo(() => {
    const client = clients.find((c) => c.id === clientId);
    const totals = fromProposal ? proposalTotals(fromProposal.items) : null;
    const contratada = parties.find((p) => p.role === "contratada");
    return {
      "cliente.nome": client?.name ?? parties.find((p) => p.role === "contratante")?.name,
      "cliente.documento": parties.find((p) => p.role === "contratante")?.document,
      "cliente.email": client?.email,
      "agencia.nome": contratada?.name,
      "agencia.documento": contratada?.document,
      servicos: fromProposal?.items
        .map((i) => `- ${i.description} (${BILLING_LABEL[i.billing]})`)
        .join("\n"),
      "valor.recorrente": totals ? formatMoney(totals.recurringMonthly) : undefined,
      "valor.unico": totals ? formatMoney(totals.oneOff) : undefined,
      "vigencia.inicio": startsOn,
      "vigencia.fim": endsOn || "prazo indeterminado",
      hoje: todayISO(),
    };
  }, [clients, clientId, parties, fromProposal, startsOn, endsOn]);

  const rendered = useMemo(() => renderTemplate(body, vars), [body, vars]);
  const pendingVars = useMemo(() => missingVariables(rendered), [rendered]);

  const patchParty = (id: string, patch: Partial<ContractParty>) =>
    setParties((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const save = async () => {
    if (!title.trim()) return toast.error("Dê um título ao contrato.");
    const filled = parties.filter((p) => p.name.trim());
    const invalid = validateParties(filled);
    if (invalid) return toast.error(invalid);
    if (pendingVars.length > 0) {
      return toast.error(
        `Ainda faltam dados no texto: ${[...new Set(pendingVars)].join(", ")}.`,
      );
    }

    setBusy(true);
    try {
      const textHash = await hashText(rendered);
      const next: Contract = {
        id: existing?.id ?? uid("ctr"),
        clientId: clientId || undefined,
        proposalId: fromProposal?.id ?? existing?.proposalId,
        title: title.trim(),
        status: existing?.status === "rascunho" || !existing ? "aguardando_partes" : existing.status,
        finalText: locked ? existing!.finalText : rendered,
        textHash: locked ? existing!.textHash : textHash,
        startsOn,
        endsOn: endsOn || undefined,
        autoRenew,
        renewNoticeDays: existing?.renewNoticeDays ?? DEFAULT_RENEW_NOTICE_DAYS,
        parties: filled,
        signatures: existing?.signatures ?? [],
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        effectiveAt: existing?.effectiveAt,
      };
      await saveContract(next);
      toast.success(existing ? "Contrato salvo." : "Contrato gerado. Mande o link a cada parte.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const status = existing ? deriveStatus(existing) : "rascunho";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="font-display text-lg">
            {existing ? existing.title : "Novo contrato"}
          </DialogTitle>
          {existing && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {CONTRACT_STATUS_LABEL[status]} ·{" "}
              <span title={existing.textHash}>hash {existing.textHash.slice(0, 12)}…</span>
            </p>
          )}
          {locked && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Já assinado: o texto está congelado. Para corrigir, cancele e gere outro.
            </p>
          )}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ctr-title">Título *</Label>
              <Input
                id="ctr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                <SelectTrigger disabled={locked}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente cadastrado</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctr-start">Início da vigência</Label>
              <Input
                id="ctr-start"
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctr-end">Fim da vigência</Label>
              <Input
                id="ctr-end"
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
                disabled={locked}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="ctr-renew"
              checked={autoRenew}
              onCheckedChange={setAutoRenew}
              disabled={locked}
            />
            <Label htmlFor="ctr-renew" className="cursor-pointer text-sm">
              Renovação automática
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Aviso {existing?.renewNoticeDays ?? DEFAULT_RENEW_NOTICE_DAYS} dias antes do fim.
            </span>
          </div>

          {/* Partes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Partes</Label>
              <span className="text-[11px] text-muted-foreground">
                Contratante, contratada e duas testemunhas, como decidido.
              </span>
              {!locked && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 gap-1"
                  onClick={() =>
                    setParties((l) => [...l, newParty("testemunha", "", l.length, false)])
                  }
                >
                  <Plus className="h-3 w-3" /> Parte
                </Button>
              )}
            </div>
            <ul className="space-y-1.5">
              {parties.map((party) => {
                const signed = existing ? hasSigned(existing, party.id) : false;
                return (
                  <li key={party.id} className="grid gap-2 sm:grid-cols-[130px_1fr_150px_auto]">
                    <Select
                      value={party.role}
                      onValueChange={(v) =>
                        patchParty(party.id, {
                          role: v as PartyRole,
                          required: v !== "testemunha",
                        })
                      }
                    >
                      <SelectTrigger className="h-9" disabled={locked} aria-label="Papel da parte">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {PARTY_ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={party.name}
                      onChange={(e) => patchParty(party.id, { name: e.target.value })}
                      placeholder="Nome"
                      aria-label="Nome da parte"
                      className="h-9"
                      disabled={locked}
                    />
                    <Input
                      value={party.document ?? ""}
                      onChange={(e) => patchParty(party.id, { document: e.target.value })}
                      placeholder="CPF / CNPJ"
                      aria-label="Documento da parte"
                      className="h-9"
                      disabled={locked}
                    />
                    <div className="flex items-center gap-1">
                      {signed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="h-3 w-3" /> assinou
                        </span>
                      ) : existing ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9"
                          title="Copiar link de assinatura desta parte"
                          onClick={() => {
                            void navigator.clipboard.writeText(shareUrl(party.token, "/assinar"));
                            toast.success(`Link de ${party.name || "parte"} copiado.`);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {!locked && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          aria-label="Remover parte"
                          onClick={() => setParties((l) => l.filter((p) => p.id !== party.id))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Texto */}
          <div className="space-y-1.5">
            <Label htmlFor="ctr-body">Texto do contrato</Label>
            <Textarea
              id="ctr-body"
              rows={12}
              value={locked ? existing!.finalText : body}
              onChange={(e) => setBody(e.target.value)}
              disabled={locked}
              className="font-mono text-xs"
            />
            {!locked && (
              <p
                className={cn(
                  "text-[11px]",
                  pendingVars.length > 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {pendingVars.length > 0
                  ? `Falta preencher: ${[...new Set(pendingVars)].join(", ")}`
                  : "Todas as variáveis do modelo foram preenchidas."}
              </p>
            )}
          </div>

          {existing && existing.signatures.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-border bg-muted p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Evidências
              </p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                {evidenceSummary(existing).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {existing && existing.signatures.length === 0 && (
            <Button
              variant="ghost"
              className="text-rose-400 hover:bg-rose-500/10"
              onClick={() => {
                if (!window.confirm("Excluir este contrato?")) return;
                void deleteContract(existing.id)
                  .then(() => {
                    toast.success("Contrato excluído.");
                    onOpenChange(false);
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Falhou."));
              }}
            >
              Excluir
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Fechar
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Salvando..." : existing ? "Salvar" : "Gerar contrato"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function newParty(role: PartyRole, name: string, order: number, required: boolean): ContractParty {
  return { id: uid("party"), role, name, order, required, token: shareToken() };
}
