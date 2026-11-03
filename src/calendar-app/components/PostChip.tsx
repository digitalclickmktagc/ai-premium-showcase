import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import type { Post, PublicPost } from "../types";
import { statusConfig } from "../status";

type PostLike = Post | PublicPost;

/** Small chip representing a post inside a calendar day cell. */
export default function PostChip({
  post,
  onClick,
  compact,
  draggable,
  dragging,
  onPointerDown,
}: {
  post: PostLike;
  onClick?: () => void;
  compact?: boolean;
  /** Enables the grab cursor + drag affordance (admin only). */
  draggable?: boolean;
  /** True while this chip is the one being dragged. */
  dragging?: boolean;
  onPointerDown?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const cfg = statusConfig(post.status);
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      title={draggable ? `${post.title} — arraste para outro dia` : post.title}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-md border border-foreground/10 bg-foreground/[0.04] px-1.5 text-left transition-colors hover:bg-foreground/[0.09]",
        compact ? "py-0.5" : "py-1",
        cfg.muted && "opacity-60",
        draggable && "ec-draggable",
        // keep the original slot visible but faded while it is being dragged
        dragging && "opacity-40",
      )}
      style={{
        borderLeft: `3px solid ${cfg.color}`,
        ...(draggable ? { cursor: dragging ? "grabbing" : "grab" } : null),
      }}
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
        <span className="ml-auto hidden shrink-0 rounded bg-foreground/[0.06] px-1 text-[9px] uppercase tracking-wide text-muted-foreground sm:inline">
          {post.contentType}
        </span>
      )}
    </button>
  );
}
