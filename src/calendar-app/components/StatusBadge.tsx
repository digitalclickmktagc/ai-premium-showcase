import { cn } from "@/lib/utils";
import type { PostStatus } from "../types";
import { SELECTABLE_STATUSES, statusConfig } from "../status";

export function StatusBadge({
  status,
  className,
}: {
  status: PostStatus;
  className?: string;
}) {
  const cfg = statusConfig(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        cfg.badgeClass,
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}

/**
 * Row of selectable status buttons (spec 4.3/4.4: change status directly in the
 * detail card). "Deletado" is handled separately via delete/restore actions.
 */
export function StatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: PostStatus;
  onChange: (status: PostStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SELECTABLE_STATUSES.map((status) => {
        const cfg = statusConfig(status);
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            onClick={() => onChange(status)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
              "disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "border-transparent text-white shadow-sm"
                : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
            style={
              active
                ? { backgroundColor: cfg.color, boxShadow: `0 4px 14px ${cfg.color}55` }
                : undefined
            }
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: active ? "#fff" : cfg.color }}
            />
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
