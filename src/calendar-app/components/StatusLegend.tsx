import { ALL_STATUSES, statusConfig } from "../status";

/**
 * Compact legend explaining the status colours used on the grid.
 *
 * With custom columns the board shows the agency's own names, so the legend
 * says whose names these are — otherwise "Feito" in the legend next to
 * "Gravação" on the board reads like a bug.
 */
export default function StatusLegend({ customStages }: { customStages?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {customStages && (
        <span className="text-xs font-medium text-muted-foreground">
          Status que o cliente vê:
        </span>
      )}
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
