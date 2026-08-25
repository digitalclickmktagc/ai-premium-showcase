import { useMemo, useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Post } from "../types";
import { toDayISO } from "../utils";
import PostChip from "./PostChip";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const COLLAPSED = 4;

/** Sort posts within a day: active statuses first, deleted last, then by title. */
function sortDayPosts(posts: Post[]): Post[] {
  const order: Record<string, number> = {
    published: 0,
    done: 1,
    rescheduled: 2,
    todo: 3,
    deleted: 4,
  };
  return [...posts].sort(
    (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.title.localeCompare(b.title),
  );
}

export default function MonthGrid({
  month,
  posts,
  accentColor = "#8b5cf6",
  readOnly,
  onPostClick,
  onDayClick,
}: {
  month: Date;
  posts: Post[];
  accentColor?: string;
  readOnly?: boolean;
  onPostClick: (post: Post) => void;
  onDayClick?: (dayISO: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    for (const [k, v] of map) map.set(k, sortDayPosts(v));
    return map;
  }, [posts]);

  const today = new Date();

  const toggleExpand = (dayISO: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dayISO)) next.delete(dayISO);
      else next.add(dayISO);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
          >
            <span className="sm:hidden">{w.charAt(0)}</span>
            <span className="hidden sm:inline">{w}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayISO = toDayISO(day);
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const dayPosts = byDay.get(dayISO) ?? [];
          const isExpanded = expanded.has(dayISO);
          const visible = isExpanded ? dayPosts : dayPosts.slice(0, COLLAPSED);
          const hidden = dayPosts.length - visible.length;

          return (
            <div
              key={dayISO}
              className={cn(
                "group relative flex min-h-[92px] flex-col gap-1 border-b border-r border-border/60 p-1 sm:min-h-[120px] sm:p-1.5",
                !inMonth && "bg-black/20",
              )}
            >
              {/* Date number + add affordance */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold sm:text-sm",
                    inMonth ? "text-foreground/80" : "text-muted-foreground/40",
                  )}
                  style={
                    isToday
                      ? { backgroundColor: accentColor, color: "#fff" }
                      : undefined
                  }
                >
                  {day.getDate()}
                </span>
                {!readOnly && onDayClick && (
                  <button
                    type="button"
                    aria-label={`Adicionar post em ${dayISO}`}
                    onClick={() => onDayClick(dayISO)}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-primary/20 hover:text-primary focus:opacity-100 group-hover:opacity-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Chips */}
              <div className="flex flex-col gap-1">
                {visible.map((post) => (
                  <PostChip
                    key={post.id}
                    post={post}
                    onClick={() => onPostClick(post)}
                  />
                ))}
              </div>

              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => toggleExpand(dayISO)}
                  className="mt-auto text-left text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  +{hidden} {hidden === 1 ? "post" : "posts"}
                </button>
              )}
              {isExpanded && dayPosts.length > COLLAPSED && (
                <button
                  type="button"
                  onClick={() => toggleExpand(dayISO)}
                  className="text-left text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  ver menos
                </button>
              )}

              {/* Empty-cell add affordance (admin only) */}
              {!readOnly && onDayClick && dayPosts.length === 0 && inMonth && (
                <button
                  type="button"
                  aria-label={`Adicionar post em ${dayISO}`}
                  onClick={() => onDayClick(dayISO)}
                  className="flex flex-1 items-center justify-center rounded-md text-[10px] text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/70 group-hover:hover:bg-white/[0.03]"
                >
                  + Post
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
