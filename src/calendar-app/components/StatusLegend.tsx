import { ALL_STATUSES, statusConfig } from "../status";

/** Compact legend explaining the status colors used on the grid. */
export default function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {ALL_STATUSES.map((status) => {
        const cfg = statusConfig(status);
        return (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: cfg.color }}
            />
            {cfg.label}
          </span>
        );
      })}
    </div>
  );
}
