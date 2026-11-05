import { useState } from "react";
import { CheckCircle2, MessageSquareWarning, Send, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ApprovalRequest, ApprovalResult, Post } from "../types";
import { approvalConfig, approvalState, toneStyles } from "../approval";
import { formatTimestamp } from "../utils";
import { useApp } from "../store/AppProvider";

const RESULT_ICON: Record<ApprovalResult, typeof CheckCircle2> = {
  approved: CheckCircle2,
  changes: MessageSquareWarning,
  rejected: XCircle,
};
const RESULT_LABEL: Record<ApprovalResult, string> = {
  approved: "Aprovou",
  changes: "Pediu ajuste",
  rejected: "Reprovou",
};
const RESULT_COLOR: Record<ApprovalResult, string> = {
  approved: "text-emerald-400",
  changes: "text-amber-400",
  rejected: "text-rose-400",
};

/** Read-only trail of what the client decided, newest round first. */
export function ApprovalHistory({ approval }: { approval: ApprovalRequest }) {
  if (approval.decisions.length === 0) return null;
  const ordered = [...approval.decisions].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ul className="space-y-2">
      {ordered.map((d) => {
        const Icon = RESULT_ICON[d.result];
        return (
          <li key={d.id} className="rounded-lg border border-border bg-muted p-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <Icon className={cn("h-3.5 w-3.5", RESULT_COLOR[d.result])} />
              <span className="font-medium">{RESULT_LABEL[d.result]}</span>
              <span className="text-muted-foreground">
                · rodada {d.round} · {d.decidedByName}
              </span>
              {d.verified && (
                <span
                  className="inline-flex items-center gap-1 text-emerald-400"
                  title="Identidade verificada por código"
                >
                  <ShieldCheck className="h-3 w-3" /> verificado
                </span>
              )}
              <span className="ml-auto text-muted-foreground">{formatTimestamp(d.at)}</span>
            </div>
            {d.comment && (
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground/90">
                {d.comment}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Admin-side approval panel inside the post dialog. */
export default function ApprovalPanel({ post }: { post: Post }) {
  const { requestApproval } = useApp();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  const state = approvalState(post.approval);
  const cfg = approvalConfig(state);
  const round = post.approval?.round ?? 0;
  const neverSent = state === "none";
  const awaiting = state === "pending";

  const send = async () => {
    setSending(true);
    try {
      await requestApproval(post.id, message);
      toast.success(
        neverSent ? "Post enviado para aprovação." : `Rodada ${round + 1} enviada ao cliente.`,
      );
      setMessage("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Aprovação do cliente
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
          style={toneStyles(cfg.color)}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
          {cfg.label}
        </span>
        {round > 0 && (
          <span className="text-xs text-muted-foreground">rodada {round}</span>
        )}
      </div>

      {post.approval && <ApprovalHistory approval={post.approval} />}

      {awaiting ? (
        <p className="text-xs text-muted-foreground">
          Aguardando a decisão do cliente no portal. Reenvie apenas se o conteúdo mudou.
        </p>
      ) : null}

      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Send className="h-3.5 w-3.5" />
          {neverSent ? "Enviar para aprovação" : "Enviar nova rodada"}
        </Button>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="approval-msg" className="text-xs">
            Mensagem para o cliente (opcional)
          </Label>
          <Textarea
            id="approval-msg"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex.: ajustamos a foto conforme pedido."
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={send} disabled={sending}>
              {sending ? "Enviando..." : "Confirmar envio"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={sending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
