import { useCallback, useEffect, useMemo, useRef } from "react";
import { CheckSquare, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardStage, Post, PostStatus } from "../types";
import { statusConfig } from "../status";
import { dropPatch, groupByStage, stageForPost } from "../stages";
import { approvalConfig, approvalState, toneStyles } from "../approval";
import { formatShortDay } from "../utils";
import { checklistProgress, formatDuration, totalMinutes } from "../cards";
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
  stages: configured,
  calendarId,
  onPostClick,
  onCreate,
  onChangeStatus,
  showDeleted,
}: {
  posts: Post[];
  /** The calendar's columns, already resolved (its own, or the standard four). */
  stages: BoardStage[];
  calendarId: string;
  onPostClick: (post: Post) => void;
  onCreate: () => void;
  onChangeStatus: (post: Post, status: PostStatus, stageId?: string) => void;
  showDeleted?: boolean;
}) {
  const stages: BoardStage[] = useMemo(() => {
    if (!showDeleted) return configured;
    // The bin is not a production stage, so it is never a configurable
    // column — it is appended only while deleted cards are being shown.
    const cfg = statusConfig("deleted");
    return [
      ...configured,
      {
        id: "std:deleted",
        calendarId,
        name: cfg.label,
        color: cfg.color,
        category: "deleted",
        order: configured.length,
      },
    ];
  }, [configured, showDeleted, calendarId]);

  const handleDrop = useCallback(
    (post: Post, stageId: string) => {
      const stage = stages.find((s) => s.id === stageId);
      if (!stage) return;
      const patch = dropPatch(post, stage);
      if (!patch) return; // dropped back where it started
      onChangeStatus(post, patch.status, patch.stageId);
    },
    [onChangeStatus, stages],
  );

  const { drag, overTarget, startDrag, consumeDragClick } = useDragToReschedule<Post>({
    enabled: true,
    onDrop: handleDrop,
    targetAttr: "stage",
  });

  /**
   * Scroll the board while a card is held near its edge.
   *
   * With custom columns a board can be wider than the screen, and a column
   * you cannot see is a column you cannot drop on. The effect re-runs on each
   * pointer move, which also means it keeps scrolling while the card is held
   * still at the edge.
   */
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!drag || !el) return;
    const EDGE_PX = 90;
    const STEP_PX = 16;
    let raf = 0;
    const tick = () => {
      const box = el.getBoundingClientRect();
      if (drag.x < box.left + EDGE_PX) el.scrollLeft -= STEP_PX;
      else if (drag.x > box.right - EDGE_PX) el.scrollLeft += STEP_PX;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [drag]);

  const byStage = useMemo(() => groupByStage(posts, stages), [posts, stages]);

  return (
    <div ref={scrollerRef} className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const items = byStage.get(stage.id) ?? [];
        const isTarget =
          Boolean(drag) &&
          overTarget === stage.id &&
          Boolean(drag && dropPatch(drag.item, stage));

        return (
          <div
            key={stage.id}
            data-stage={stage.id}
            className={cn(
              "flex w-[260px] shrink-0 flex-col rounded-xl border border-border bg-card transition-colors",
              isTarget && "border-primary bg-primary/10 ring-2 ring-inset ring-primary",
            )}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <h3 className="truncate text-sm font-semibold" title={stage.name}>
                {stage.name}
              </h3>
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
                const checks = checklistProgress(post.checklist);
                const logged = totalMinutes(post.timeEntries);
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
                      borderLeft: `3px solid ${stage.color}`,
                      cursor: dragging ? "grabbing" : "grab",
                    }}
                  >
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        stage.category === "deleted" && "line-through opacity-70",
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
                      {checks.total > 0 && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 text-[10px]",
                            checks.complete ? "text-emerald-500" : "text-muted-foreground",
                          )}
                          title={`Checklist: ${checks.done} de ${checks.total}`}
                        >
                          <CheckSquare className="h-3 w-3" />
                          {checks.done}/{checks.total}
                        </span>
                      )}
                      {logged > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
                          title="Tempo lançado"
                        >
                          <Clock className="h-3 w-3" />
                          {formatDuration(logged)}
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

              {stage.category === "todo" && stage.order === 0 && (
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
            borderLeft: `3px solid ${
              stageForPost(drag.item, stages)?.color ?? statusConfig(drag.item.status).color
            }`,
          }}
        >
          <span className="block truncate">{drag.item.title}</span>
        </div>
      )}
    </div>
  );
}
