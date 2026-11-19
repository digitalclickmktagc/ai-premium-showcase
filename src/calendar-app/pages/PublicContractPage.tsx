import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FileSignature, FileX2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Contract } from "../types";
import { getDataService } from "../services";
import {
  CONTRACT_STATUS_LABEL,
  PARTY_ROLE_LABEL,
  deriveStatus,
  hasSigned,
  signatureOf,
} from "../contracts";
import EmptyState from "../components/EmptyState";

/**
 * One party's signing page (spec 07 §4.4).
 *
 * The link is per party, so a signatory never sees anyone else's link. What
 * is signed is the exact text on this screen: the signature records the
 * contract's hash, and the text cannot change afterwards — which is the
 * whole evidentiary weight of a simple electronic signature.
 */
export default function PublicContractPage() {
  const { token = "" } = useParams();
  const service = useMemo(() => getDataService(), []);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ contract: Contract; partyId: string } | null>(null);
  const [typedName, setTypedName] = useState("");
  const [typedDocument, setTypedDocument] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await service.getPublicContract(token));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [service, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const sign = async () => {
    setBusy(true);
    try {
      await service.signContract(token, { typedName, typedDocument });
      toast.success("Assinatura registrada.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível assinar.");
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

  if (!data) {
    return (
      <div className="ce-app flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <EmptyState
          icon={<FileX2 className="h-10 w-10" />}
          title="Contrato indisponível"
          description="Este link não está válido. Peça um novo à agência."
        />
      </div>
    );
  }

  const { contract, partyId } = data;
  const me = contract.parties.find((p) => p.id === partyId);
  const signed = hasSigned(contract, partyId);
  const mySignature = signatureOf(contract, partyId);
  const status = deriveStatus(contract);

  return (
    <div className="ce-app min-h-[100dvh] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileSignature className="h-4 w-4" />
            {CONTRACT_STATUS_LABEL[status]}
          </div>
          <h1 className="font-display text-2xl font-bold">{contract.title}</h1>
          {me && (
            <p className="text-sm text-muted-foreground">
              Você está assinando como <strong>{PARTY_ROLE_LABEL[me.role]}</strong>: {me.name}
            </p>
          )}
        </header>

        <section className="rounded-xl border border-border bg-card p-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {contract.finalText}
          </pre>
        </section>

        <section className="rounded-xl border border-border bg-muted p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Partes
          </p>
          <ul className="mt-1.5 space-y-1 text-xs">
            {contract.parties.map((p) => {
              const sig = signatureOf(contract, p.id);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{PARTY_ROLE_LABEL[p.role]}:</span>
                  <span>{p.name}</span>
                  {sig ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      assinou em {new Date(sig.at).toLocaleString("pt-BR")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">pendente</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 break-all text-[10px] text-muted-foreground">
            Identificador do texto (SHA-256): {contract.textHash}
          </p>
        </section>

        {signed ? (
          <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-2 font-medium">Você já assinou este contrato.</p>
            {mySignature && (
              <p className="mt-1 text-xs text-muted-foreground">
                {mySignature.typedName} · {new Date(mySignature.at).toLocaleString("pt-BR")}
              </p>
            )}
            {status === "vigente" && (
              <p className="mt-2 text-sm">Todas as partes assinaram. O contrato está vigente.</p>
            )}
          </section>
        ) : (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className="text-sm">
              Ao assinar, você declara ter lido o texto acima e concorda com ele. Ficam
              registrados seu nome, documento, data e navegador.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sig-name">Nome completo *</Label>
                <Input
                  id="sig-name"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sig-doc">CPF ou CNPJ *</Label>
                <Input
                  id="sig-doc"
                  value={typedDocument}
                  onChange={(e) => setTypedDocument(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
            <Button onClick={sign} disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assinar contrato
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
