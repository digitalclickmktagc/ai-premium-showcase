import { cn } from "@/lib/utils";
import type { Post } from "../types";
import { statusConfig } from "../status";

/** Small chip representing a post inside a calendar day cell. */
export default function PostChip({
  post,
  onClick,
  compact,
}: {
  post: Post;
  onClick?: () => void;
  compact?: boolean;
}) {
  const cfg = statusConfig(post.status);
  return (
    <button
      type="button"
      onClick={onClick}
      title={post.title}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.03] px-1.5 text-left transition-colors hover:bg-white/[0.08]",
        compact ? "py-0.5" : "py-1",
        cfg.muted && "opacity-60",
      )}
      style={{ borderLeft: `3px solid ${cfg.color}` }}
    >
      <span
        className={cn(
          "truncate text-[11px] font-medium leading-tight text-foreground/90",
          cfg.muted && "line-through",
        )}
      >
        {post.title}
      </span>
      {post.contentType && !compact && (
        <span className="ml-auto hidden shrink-0 rounded bg-white/5 px-1 text-[9px] uppercase tracking-wide text-muted-foreground sm:inline">
          {post.contentType}
        </span>
      )}
    </button>
  );
}
