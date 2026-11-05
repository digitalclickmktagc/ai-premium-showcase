import { useMemo } from "react";
import { Pin, PinOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Client, Post } from "../types";
import { CLIENT_STATUS_LABEL, clientHealth, healthTone, normalizeStatus } from "../health";
import { toneStyles } from "../approval";

/**
 * Relationship health pill with its breakdown on hover.
 *
 * The spec requires the screen to show which signal removed what: a bare
 * number nobody can explain is not actionable.
 */
export function HealthPill({
  posts,
  client,
  className,
}: {
  posts: Post[];
  client: Client;
  className?: string;
}) {
  const health = useMemo(
    () => clientHealth(posts, { clientCreatedAt: client.createdAt?.slice(0, 10) }),
    [posts, client.createdAt],
  );
  const tone = healthTone(health.value);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-help items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            className,
          )}
          style={toneStyles(tone.color)}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.color }} />
          {health.value}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        <p className="font-semibold">
          Relacionamento: {health.value}/100 · {tone.label}
        </p>
        {health.signals.length === 0 ? (
          <p className="mt-1 text-xs">Nenhum sinal negativo.</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-xs">
            {health.signals.map((s) => (
              <li key={s.key} className="flex justify-between gap-3">
                <span>{s.label}</span>
                <span className="font-mono">{s.points}</span>
              </li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Lifecycle chip (Ativo / Pausado / Encerrado / Arquivado). */
export function StatusChip({ client }: { client: Client }) {
  const status = normalizeStatus(client);
  if (status === "active") return null; // the common case needs no chip
  return (
    <span className="shrink-0 rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
      {CLIENT_STATUS_LABEL[status]}
    </span>
  );
}

/** Pin / unpin toggle. */
export function PinButton({
  pinned,
  onToggle,
}: {
  pinned: boolean;
  onToggle: () => void;
}) {
  const Icon = pinned ? PinOff : Pin;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={pinned ? "Desafixar cliente" : "Fixar cliente no topo"}
      title={pinned ? "Desafixar" : "Fixar no topo"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        pinned
          ? "text-primary"
          : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
