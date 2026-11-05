import { useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Post, PostStatus } from "../types";
import { SELECTABLE_STATUSES, statusConfig } from "../status";
import { approvalConfig, approvalState, toneStyles } from "../approval";
import { formatShortDay } from "../utils";
import { useDragToReschedule } from "../hooks/useDragToReschedule";

/**
 * Board (kanban) view over the same posts the calendar shows.
 *
 * Spec 02 calls for several views of one query; this is the column view, with
 * stages taken from the post status. Dragging a card between columns changes
 * the stage, reusing the pointer-drag engine built for the calendar.
 */
export default function BoardView({
  posts,
  onPostClick,
  onCreate,
  onChangeStatus,
  showDeleted,
}: {
  posts: Post[];
  onPostClick: (post: Post) => void;
  onCreate: () => void;
  onChangeStatus: (post: Post, status: PostStatus) => void;
  showDeleted?: boolean;
}) {
  const stages: PostStatus[] = useMemo(
    () => (showDeleted ? [...SELECTABLE_STATUSES, "deleted"] : SELECTABLE_STATUSES),
    [showDeleted],
  );

  const handleDrop = useCallback(
    (post: Post, stage: string) => {
      if (!stage || stage === post.status) return;
      onChangeStatus(post, stage as PostStatus);
    },
    [onChangeStatus],
  );

  const { drag, overTarget, startDrag, consumeDragClick } = useDragToReschedule<Post>({
    enabled: true,
    onDrop: handleDrop,
    targetAttr: "stage",
  });

  const byStage = useMemo(() => {
    const map = new Map<PostStatus, Post[]>();
    for (const s of stages) map.set(s, []);
    for (const p of posts) {
      if (!map.has(p.status)) continue;
      map.get(p.status)!.push(p);
    }
    // soonest first inside a column
    for (const [, list] of map) list.sort((a, b) => a.date.localeCompare(b.date));
    return map;
  }, [posts, stages]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const cfg = statusConfig(stage);
        const items = byStage.get(stage) ?? [];
        const isTarget = Boolean(drag) && overTarget === stage && drag?.item.status !== stage;

        return (
          <div
            key={stage}
            data-stage={stage}
            className={cn(
              "flex w-[260px] shrink-0 flex-col rounded-xl border border-border bg-card transition-colors",
              isTarget && "border-primary bg-primary/10 ring-2 ring-inset ring-primary",
            )}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
              <h3 className="truncate text-sm font-semibold">{cfg.label}</h3>
              <span className="ml-auto rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
              {items.map((post) => {
                const aState = approvalState(post.approval);
                const aCfg = approvalConfig(aState);
                const dragging = drag?.item.id === post.id;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onPointerDown={(e) => startDrag(e, post)}
                    onClick={() => {
                      if (consumeDragClick()) return;
                      onPostClick(post);
                    }}
                    className={cn(
                      "ec-draggable rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:border-primary/40",
                      dragging && "opacity-40",
                    )}
                    style={{
                      borderLeft: `3px solid ${cfg.color}`,
                      cursor: dragging ? "grabbing" : "grab",
                    }}
                  >
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        cfg.muted && "line-through opacity-70",
                      )}
                    >
                      {post.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        {formatShortDay(post.date)}
                      </span>
                      {post.contentType && (
                        <span className="rounded bg-foreground/[0.06] px-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                          {post.contentType}
                        </span>
                      )}
                      {aState !== "none" && (
                        <span
                          className="ml-auto rounded-full border px-1.5 py-0.5 text-[9px] font-medium"
                          style={toneStyles(aCfg.color)}
                          title={`Aprovação: ${aCfg.label}`}
                        >
                          {aCfg.label}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {items.length === 0 && (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground/70">
                  Arraste um post para cá
                </p>
              )}

              {stage === "todo" && (
                <button
                  type="button"
                  onClick={onCreate}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Novo post
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Card following the pointer */}
      {drag && (
        <div
          className="pointer-events-none fixed z-[60] max-w-[220px] rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-lg"
          style={{
            left: drag.x + 12,
            top: drag.y - 10,
            borderLeft: `3px solid ${statusConfig(drag.item.status).color}`,
          }}
        >
          <span className="block truncate">{drag.item.title}</span>
        </div>
      )}
    </div>
  );
}
