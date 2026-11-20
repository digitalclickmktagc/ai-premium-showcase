import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  Plug,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import AdminLayout from "../components/AdminLayout";
import EmptyState from "../components/EmptyState";
import { useApp } from "../store/AppProvider";
import {
  EVENTS,
  MAX_ATTEMPTS,
  newSecret,
  newSubscription,
  shouldDisable,
  subscriptionHealth,
  validateSubscription,
} from "../webhooks";
import type { WebhookEvent, WebhookSubscription } from "../types";
import { formatTimestamp } from "../utils";

/**
 * Integrações — webhooks de saída (benchmark ficha 22, F22).
 *
 * The screen is honest about the one thing that matters: enqueueing is done,
 * delivering needs the Edge Function published. A queue that grows while the
 * agency believes its systems are being notified is worse than no webhook.
 */
export default function IntegrationsPage() {
  const {
    webhooks,
    webhookDeliveries,
    serviceName,
    saveWebhook,
    deleteWebhook,
    enqueueWebhookTest,
  } = useApp();

  const [draft, setDraft] = useState<WebhookSubscription | null>(null);
  const [showSecret, setShowSecret] = useState<string | null>(null);

  const stuck = useMemo(
    () => webhookDeliveries.filter((d) => d.status === "pendente").length,
    [webhookDeliveries],
  );

  return (
    <AdminLayout section="integracoes" title="Integrações">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Integrações</h1>
          <p className="text-xs text-muted-foreground">
            Avise outro sistema quando algo acontece aqui: post aprovado, proposta aceita,
            contrato assinado, conta liquidada.
          </p>
        </div>
        <Button
          className="gap-1.5"
          onClick={() => setDraft(newSubscription("https://", ["post.aprovado"]))}
        >
          <Plus className="h-4 w-4" /> Nova integração
        </Button>
      </header>

      <section className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
        <p className="flex items-start gap-1.5 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            <strong>Enfileirar está pronto; entregar depende de publicar a função.</strong> Os
            eventos são gravados por gatilhos no banco — então disparam venha a mudança daqui, do
            link do cliente ou de alguém editando direto. Quem faz o POST é a Edge Function{" "}
            <code>dispatch-webhooks</code>, que precisa estar publicada e agendada no Supabase
            (passo a passo em <code>supabase/functions/README.md</code>).
            {serviceName === "localStorage" && (
              <>
                {" "}
                Nesta demonstração em localStorage não há servidor nenhum: a fila fica guardada
                aqui e nada sai.
              </>
            )}
            {stuck > 0 && <> Há {stuck} entrega(s) na fila.</>}
          </span>
        </p>
      </section>

      {webhooks.length === 0 && !draft ? (
        <EmptyState
          icon={<Plug className="h-8 w-8" />}
          title="Nenhuma integração"
          description="Útil para avisar um ERP, uma planilha, um bot do WhatsApp ou um automatizador quando o cliente aprova um post."
        />
      ) : (
        <ul className="space-y-3">
          {webhooks.map((hook) => {
            const health = subscriptionHealth(hook.id, webhookDeliveries);
            const recent = webhookDeliveries
              .filter((d) => d.subscriptionId === hook.id)
              .slice(0, 5);
            return (
              <li key={hook.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{hook.url}</span>
                  <Switch
                    checked={hook.active}
                    aria-label={`Integração ${hook.url} ativa`}
                    onCheckedChange={(on) => void saveWebhook({ ...hook, active: on })}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[11px]"
                    onClick={async () => {
                      await enqueueWebhookTest(hook.id);
                      toast.success("Evento de teste enfileirado.");
                    }}
                  >
                    <Send className="h-3.5 w-3.5" /> testar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[11px]"
                    onClick={() => setDraft(hook)}
                  >
                    editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[11px] text-destructive"
                    onClick={() => {
                      if (!window.confirm("Apagar esta integração e seu histórico de entregas?"))
                        return;
                      void deleteWebhook(hook.id).then(() => toast.success("Integração apagada."));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <p className="mt-1 text-[11px] text-muted-foreground">
                  {hook.events.length} evento(s): {hook.events.join(", ")}
                </p>

                <p className="mt-1 text-[11px] text-muted-foreground">
                  {health.total === 0
                    ? "Nenhuma entrega ainda."
                    : `${health.delivered} entregue(s), ${health.failed} falha(s), ${health.pending} na fila${
                        health.rate === null ? "" : ` · ${health.rate}% de sucesso`
                      }`}
                  {health.lastError && ` · último erro: ${health.lastError}`}
                </p>

                {shouldDisable(health) && hook.active && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                    <AlertTriangle className="h-3 w-3" /> Este endereço só falhou. Vale desligar
                    até arrumar — martelar endpoint morto é como se leva bloqueio.
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Segredo:</span>
                  <code className="rounded bg-foreground/[0.05] px-1.5 py-0.5 text-[11px]">
                    {showSecret === hook.id ? hook.secret : "•".repeat(16)}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5"
                    aria-label={showSecret === hook.id ? "Esconder segredo" : "Mostrar segredo"}
                    onClick={() => setShowSecret(showSecret === hook.id ? null : hook.id)}
                  >
                    {showSecret === hook.id ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5"
                    aria-label="Copiar segredo"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(hook.secret)
                        .then(() => toast.success("Segredo copiado."))
                        .catch(() => toast.error("Não deu para copiar."));
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Confira o cabeçalho <code>X-Orkestrya-Signature</code> com ele.
                  </span>
                </div>

                {recent.length > 0 && (
                  <ul className="mt-2 divide-y divide-border text-[11px]">
                    {recent.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-2 py-1">
                        <span
                          className={cn(
                            "w-16 shrink-0",
                            d.status === "entregue"
                              ? "text-emerald-600"
                              : d.status === "falhou"
                                ? "text-destructive"
                                : "text-muted-foreground",
                          )}
                        >
                          {d.status}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{d.event}</span>
                        <span className="text-muted-foreground">
                          {d.attempts}/{MAX_ATTEMPTS} tentativa(s)
                        </span>
                        <span className="text-muted-foreground">
                          {formatTimestamp(d.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <section className="mt-4 rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {webhooks.some((w) => w.id === draft.id) ? "Editar integração" : "Nova integração"}
          </p>
          <div className="grid gap-2">
            <div className="grid gap-1">
              <Label htmlFor="wh-url" className="text-[11px]">
                Endereço (https)
              </Label>
              <Input
                id="wh-url"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                placeholder="https://automacao.exemplo.com/orkestrya"
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="wh-desc" className="text-[11px]">
                Para que serve
              </Label>
              <Input
                id="wh-desc"
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Avisar a planilha de produção"
                className="h-9"
              />
            </div>
            <fieldset className="grid gap-1">
              <legend className="text-[11px] text-muted-foreground">Eventos</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {EVENTS.map((event) => (
                  <label key={event.id} className="flex items-start gap-2 text-xs">
                    <Checkbox
                      className="mt-0.5"
                      checked={draft.events.includes(event.id)}
                      aria-label={event.label}
                      onCheckedChange={(on) =>
                        setDraft({
                          ...draft,
                          events: on
                            ? [...draft.events, event.id as WebhookEvent]
                            : draft.events.filter((e) => e !== event.id),
                        })
                      }
                    />
                    <span>
                      <span className="block">{event.label}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {event.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={async () => {
                  const invalid = validateSubscription(draft);
                  if (invalid) return toast.error(invalid);
                  await saveWebhook(draft);
                  setDraft(null);
                  toast.success("Integração salva.");
                }}
              >
                Salvar
              </Button>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => setDraft({ ...draft, secret: newSecret() })}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Trocar segredo
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O payload leva ids e fatos — nunca legenda, nota interna, e-mail de cliente ou nome
              de quem marcou horário. Quem recebe pergunta à API o que tiver direito de ver.
            </p>
          </div>
        </section>
      )}
    </AdminLayout>
  );
}
