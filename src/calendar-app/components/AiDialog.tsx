import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  actionById,
  buildRequest,
  previewRequest,
  tooBig,
  type AiActionId,
  type AiContext,
} from "../ai";
import { aiMode, askAi, type AiAnswer } from "../services/aiClient";
import { useApp } from "../store/AppProvider";

/**
 * A janela única por onde toda pergunta à IA passa.
 *
 * Ela existe para que três coisas sejam sempre verdade, em qualquer tela:
 *
 *  1. **Nada sai sem alguém ver.** Antes de mandar, a janela mostra, em texto,
 *     exatamente o que vai — instrução e dados, do jeito que a IA vai receber.
 *  2. **Nada entra sem alguém clicar.** A resposta fica parada até alguém
 *     apertar "Aplicar". Fechar a janela joga a resposta fora.
 *  3. **O erro é em português.** Nenhum código de API aparece para quem está
 *     usando; a mensagem diz o que houve e o que fazer.
 */
export interface AiDialogProps {
  action: AiActionId;
  /** Montado só quando a janela abre — a tela não paga por isso à toa. */
  context: () => AiContext;
  clientId?: string | null;
  /** Quando existe, aparece o botão "Aplicar". Devolve true se aplicou. */
  onApply?: (text: string) => boolean | void;
  applyLabel?: string;
  /** Aparência do botão que abre. */
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm";
  label?: string;
  className?: string;
}

export default function AiDialog({
  action,
  context,
  clientId,
  onApply,
  applyLabel = "Aplicar",
  variant = "outline",
  size = "sm",
  label,
  className,
}: AiDialogProps) {
  const meta = actionById(action);
  const { aiSettings } = useApp();
  const [open, setOpen] = useState(false);
  const [showData, setShowData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [built, setBuilt] = useState<AiContext | null>(null);

  // A chave do assistente é uma só: o interruptor em Integrações. Sem ele
  // ligado, nenhuma tela pergunta nada — nem no modo navegador.
  const allowed =
    aiSettings?.enabled === true &&
    (aiSettings.allowed.length === 0 || aiSettings.allowed.includes(action));
  const mode = useMemo(
    () => (open && allowed ? aiMode() : "desligado"),
    [open, allowed],
  );

  useEffect(() => {
    if (!open) {
      setAnswer(null);
      setShowData(false);
      setBuilt(null);
      return;
    }
    try {
      setBuilt(context());
    } catch {
      setBuilt({ data: {}, missing: "Não consegui montar o pedido com os dados desta tela." });
    }
    // `context` muda a cada render da tela de cima; depender dela reabriria em laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!meta) return null;

  const blocked =
    built?.missing ??
    (built && tooBig(built.data)
      ? "Há dado demais nesta tela para mandar de uma vez. Filtre e tente de novo."
      : undefined);

  const request = built && !blocked ? buildRequest(action, built) : null;

  async function ask() {
    if (!request) return;
    setBusy(true);
    setAnswer(null);
    try {
      setAnswer(await askAi(request, clientId));
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!answer?.ok || !onApply) return;
    // Quem aplica avisa o que aconteceu, na linguagem da própria tela.
    // Devolver false mantém a janela aberta (não deu para aplicar).
    if (onApply(answer.text) === false) return;
    setOpen(false);
  }

  async function copy() {
    if (!answer?.ok) return;
    try {
      await navigator.clipboard.writeText(answer.text);
      toast.success("Copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e use Ctrl+C.");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
        {label ?? meta.label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              {meta.label}
            </DialogTitle>
            <DialogDescription>{meta.what}</DialogDescription>
          </DialogHeader>

          {mode === "desligado" ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              O assistente está desligado. Quem administra liga em{" "}
              <strong>Integrações → Assistente de IA</strong>. Enquanto isso, tudo no
              sistema funciona sem ele.
            </p>
          ) : blocked ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {blocked}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">O que vai ser enviado</p>
                <p className="mt-1 text-muted-foreground">{meta.sends}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  E-mail, telefone, documento e qualquer chave são removidos antes de sair
                  daqui. {mode === "navegador"
                    ? "Neste modo, a chave da Anthropic é a que está guardada neste navegador."
                    : "A chave da Anthropic fica no servidor; este navegador não a vê."}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 px-0 text-xs"
                  onClick={() => setShowData((v) => !v)}
                >
                  {showData ? (
                    <EyeOff className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  )}
                  {showData ? "Esconder o texto exato" : "Ver o texto exato"}
                </Button>
                {showData && request && (
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-xs">
                    {previewRequest(request)}
                  </pre>
                )}
              </div>

              {answer?.ok === false && (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  {answer.message}
                </p>
              )}

              {answer?.ok && (
                <div className="space-y-2">
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-background p-3 text-sm">
                    {answer.text || "A IA não devolveu texto."}
                  </pre>
                  {answer.truncated && (
                    <p className="text-xs text-muted-foreground">
                      A resposta foi cortada no limite de tamanho. Peça em partes menores.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Sugestão de IA. Confira antes de usar — ela erra, e quem assina é você.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <div className="flex flex-wrap gap-2">
              {answer?.ok && (
                <Button type="button" variant="outline" onClick={copy}>
                  <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                  Copiar
                </Button>
              )}
              {answer?.ok && onApply && (
                <Button type="button" onClick={apply}>
                  <Check className="mr-1.5 h-4 w-4" aria-hidden />
                  {applyLabel}
                </Button>
              )}
              {mode !== "desligado" && !blocked && (
                <Button type="button" onClick={ask} disabled={busy || !request}>
                  <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
                  {busy ? "Perguntando…" : answer ? "Perguntar de novo" : "Perguntar"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
