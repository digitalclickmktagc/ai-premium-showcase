import { useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shareUrl } from "../utils";

/**
 * Copy / open / regenerate control for a calendar's public share link.
 * The token is the sole access credential, so regenerating it revokes any
 * previously shared link.
 */
export default function ShareLink({
  token,
  onRegenerate,
  compact,
}: {
  token: string;
  onRegenerate?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url = shareUrl(token);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado para a área de transferência");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — show the URL.
      toast.info(url, { description: "Copie o link manualmente." });
    }
  };

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={copy}
        className="gap-1.5"
        title={url}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        Copiar link
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="flex-1 truncate rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
        {url}
      </code>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button variant="outline" size="icon" asChild className="h-9 w-9" title="Abrir">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
        {onRegenerate && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRegenerate}
            className={cn("h-9 w-9")}
            title="Gerar novo link (revoga o anterior)"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
