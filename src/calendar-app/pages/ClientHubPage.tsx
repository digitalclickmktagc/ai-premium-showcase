import { Navigate, useParams } from "react-router-dom";
import {
  FileText,
  FolderOpen,
  MessageSquare,
  ScrollText,
  Sparkles,
  Wallet,
} from "lucide-react";
import { FEATURES } from "../features";

/**
 * Client hub shell (Spec 05).
 *
 * Built but DISABLED: `VITE_FEATURE_CLIENT_HUB` is false by default, as
 * decided, so this route redirects to the existing read-only share view until
 * the hub is switched on.
 *
 * Areas follow the spec's defaults for a new client — entregas, revisões,
 * arquivos, contratos, recados — with financeiro present but off, per the
 * decision not to show financials to clients (D9).
 */
const AREAS = [
  {
    key: "entregas",
    label: "Entregas",
    icon: FileText,
    description: "Acompanhar o que está em produção.",
    ready: false,
  },
  {
    key: "revisoes",
    label: "Revisões",
    icon: Sparkles,
    description: "Aprovar sem precisar do link — já funciona pelo calendário.",
    ready: true,
  },
  {
    key: "arquivos",
    label: "Arquivos",
    icon: FolderOpen,
    description: "Materiais liberados pela agência.",
    ready: false,
  },
  {
    key: "contratos",
    label: "Contratos",
    icon: ScrollText,
    description: "Baixar o contrato assinado.",
    ready: false,
  },
  {
    key: "recados",
    label: "Recados",
    icon: MessageSquare,
    description: "Conversa direta com a equipe.",
    ready: false,
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    description: "Desativado por decisão: o cliente não vê financeiro.",
    ready: false,
    disabledByDecision: true,
  },
] as const;

export default function ClientHubPage() {
  const { token = "" } = useParams();

  // Flag off → the hub does not exist for the visitor.
  if (!FEATURES.clientHub) {
    return <Navigate to={`/c/${token}`} replace />;
  }

  return (
    <div className="ce-app min-h-[100dvh] bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold">Hub do cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estrutura preparada. Cada área entra conforme as ondas forem concluídas.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.key}
                className="rounded-xl border border-border bg-card p-4 opacity-100"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-sm font-semibold">{a.label}</h2>
                  <span
                    className={
                      a.ready
                        ? "ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300"
                        : "ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                    }
                  >
                    {"disabledByDecision" in a && a.disabledByDecision
                      ? "fora por decisão"
                      : a.ready
                        ? "pronto"
                        : "a construir"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{a.description}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
