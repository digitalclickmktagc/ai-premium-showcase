import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageSquareWarning,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ApprovalResult, Post, PublicPost } from "../types";
import { approvalConfig, approvalState, toneStyles, validateDecision } from "../approval";
import { getDataService } from "../services";
import { ApprovalHistory } from "./ApprovalPanel";

type PostLike = Post | PublicPost;

const OPTIONS: {
  result: ApprovalResult;
  label: string;
  icon: typeof CheckCircle2;
  className: string;
}[] = [
  {
    result: "approved",
    label: "Aprovar",
    icon: CheckCircle2,
    className: "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10",
  },
  {
    result: "changes",
    label: "Pedir ajuste",
    icon: MessageSquareWarning,
    className: "border-amber-500/40 text-amber-300 hover:bg-amber-500/10",
  },
  {
    result: "rejected",
    label: "Reprovar",
    icon: XCircle,
    className: "border-rose-500/40 text-rose-300 hover:bg-rose-500/10",
  },
];

/**
 * Client-side decision panel shown inside the read-only post dialog.
 *
 * Decisions taken through the public link always require a verification code
 * (decision A2). Where no e-mail transport is configured the service hands the
 * code back so the test environment can display it.
 */
export default function ClientDecisionPanel({
  post,
  token,
  maskedEmail,
  onDecided,
}: {
  post: PostLike;
  token: string;
  maskedEmail?: string;
  onDecided: () => void;
}) {
  const [result, setResult] = useState<ApprovalResult | null>(null);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  // The code exists but no e-mail left: say it plainly instead of leaving the
  // client watching an inbox that will never ring.
  const [undelivered, setUndelivered] = useState(false);
  const [busy, setBusy] = useState(false);

  const state = approvalState(post.approval);
  const cfg = approvalConfig(state);
  if (state === "none") return null; // never sent to the client

  const needsComment = result === "changes" || result === "rejected";

  const sendCode = async () => {
    setBusy(true);
    try {
      const res = await getDataService().issueApprovalCode(token, post.id);
      setCodeSent(true);
      setDevCode(res.devCode ?? null);
      const delivered = res.delivered !== false;
      setUndelivered(!delivered && !res.devCode);
      if (delivered) {
        toast.success(
          res.maskedEmail
            ? `Código enviado para ${res.maskedEmail}`
            : "Código enviado.",
        );
      } else {
        toast.info("Código gerado.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o código.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!result) return;
    const invalid = validateDecision({ result, comment, decidedByName: name });
    if (invalid) {
      toast.error(invalid);
      return;
    }
    if (!code.trim()) {
      toast.error("Informe o código de verificação.");
      return;
    }
    setBusy(true);
    try {
      await getDataService().submitApprovalDecision(token, post.id, {
        result,
        comment,
        decidedByName: name,
        code,
      });
      toast.success("Decisão registrada. Obrigado!");
      setResult(null);
      setComment("");
      setCode("");
      setCodeSent(false);
      setDevCode(null);
      onDecided();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sua aprovação
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
          style={toneStyles(cfg.color)}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
          {cfg.label}
        </span>
      </div>

      {post.approval?.teamMessage && (
        <p className="rounded-md bg-muted p-2 text-sm text-foreground/90">
          <span className="text-muted-foreground">Mensagem da agência: </span>
          {post.approval.teamMessage}
        </p>
      )}

      {post.approval && post.approval.decisions.length > 0 && (
        <ApprovalHistory approval={post.approval} />
      )}

      <p className="text-xs text-muted-foreground">
        {state === "pending"
          ? "Escolha uma opção abaixo."
          : "Você já decidiu. Pode registrar uma nova decisão se mudou de ideia."}
      </p>

      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          const active = result === o.result;
          return (
            <Button
              key={o.result}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResult(active ? null : o.result)}
              className={cn("gap-1.5", o.className, active && "ring-2 ring-primary")}
            >
              <Icon className="h-3.5 w-3.5" />
              {o.label}
            </Button>
          );
        })}
      </div>

      {result && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="dec-name">Seu nome *</Label>
            <Input
              id="dec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como devemos registrar quem decidiu"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dec-comment">
              {needsComment ? "O que precisa mudar? *" : "Comentário (opcional)"}
            </Label>
            <Textarea
              id="dec-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                needsComment ? "Descreva o ajuste necessário" : "Algo a acrescentar?"
              }
            />
          </div>

          {/* Verification — mandatory for link-based decisions */}
          <div className="space-y-2 rounded-md border border-border bg-muted p-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Confirmação de identidade
            </p>
            {!codeSent ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {maskedEmail
                    ? `Enviaremos um código para ${maskedEmail}.`
                    : "Geraremos um código de confirmação."}
                </p>
                <Button size="sm" variant="outline" onClick={sendCode} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Enviar código
                </Button>
              </>
            ) : (
              <>
                {devCode && (
                  <p className="rounded bg-amber-400 px-2 py-1 text-xs font-semibold text-amber-950">
                    Ambiente de testes — seu código é <strong>{devCode}</strong>
                  </p>
                )}
                {undelivered && (
                  <p className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                    O código foi gerado, mas o envio por e-mail ainda não está
                    configurado nesta instalação. Peça o código à agência para
                    concluir.
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="dec-code" className="text-xs">
                    Código de 6 dígitos
                  </Label>
                  <Input
                    id="dec-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-32 tracking-[0.3em]"
                  />
                </div>
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={busy}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Reenviar código
                </button>
              </>
            )}
          </div>

          <Button onClick={submit} disabled={busy || !codeSent} className="w-full">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar decisão
          </Button>
        </div>
      )}
    </div>
  );
}
