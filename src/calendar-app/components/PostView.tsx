import { CalendarClock, ExternalLink, History } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Post, PublicPost } from "../types";
import { statusConfig } from "../status";
import { formatLongDay, formatTimestamp } from "../utils";
import { StatusBadge } from "./StatusBadge";

type PostLike = Post | PublicPost;

/** Read-only reschedule history block (shared by admin modal + client view). */
export function RescheduleHistory({
  history,
}: {
  history: Post["rescheduleHistory"];
}) {
  return (
    <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200/90">
        <History className="h-3.5 w-3.5" /> Histórico de reagendamento
      </h4>
      <ul className="space-y-1 text-sm text-foreground/80">
        {history.map((h, i) => (
          <li key={i} className="flex flex-wrap items-center gap-1.5">
            <span className="line-through opacity-70">{formatLongDay(h.from)}</span>
            <span className="text-amber-300">→</span>
            <span className="font-medium">{formatLongDay(h.to)}</span>
            <span className="text-xs text-muted-foreground">({formatTimestamp(h.at)})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Read-only body shown to clients (never renders internal notes). */
export function PostReadOnlyBody({ post }: { post: PostLike }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={post.status} />
        {post.contentType && (
          <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground">
            {post.contentType}
          </span>
        )}
      </div>

      {post.description ? (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Descrição / legenda
          </h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {post.description}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sem descrição.</p>
      )}

      {post.referenceLink && (
        <a
          href={post.referenceLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver referência / anexo
        </a>
      )}

      {post.rescheduleHistory.length > 0 && (
        <RescheduleHistory history={post.rescheduleHistory} />
      )}
    </div>
  );
}

/** Client-facing read-only post dialog. Uses no admin state. */
export default function PostViewDialog({
  open,
  onOpenChange,
  post,
  accentColor = "#8b5cf6",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: PostLike | null;
  accentColor?: string;
}) {
  if (!post) return null;
  const cfg = statusConfig(post.status);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          "max-sm:h-[100dvh] max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
          "sm:max-h-[90vh] sm:max-w-xl",
        )}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span
            className="mt-1 h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: cfg.color }}
          />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate pr-8 font-display text-lg">
              {post.title}
            </DialogTitle>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatLongDay(post.date)}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <PostReadOnlyBody post={post} />
        </div>

        <div className="flex border-t border-border px-5 py-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="ml-auto"
            style={{ borderColor: `${accentColor}55` }}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
