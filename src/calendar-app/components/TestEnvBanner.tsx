import { FlaskConical } from "lucide-react";

/**
 * Unmistakable marker that the app is running in the test environment.
 *
 * Rendered only when VITE_APP_ENV=test (see .env.test / `bun run dev:test`),
 * where the app runs on local browser storage and never touches the
 * production Supabase project.
 *
 * The pill is opaque on purpose: it stays legible over both the light and the
 * dark theme without depending on theme tokens.
 */
export default function TestEnvBanner() {
  if (import.meta.env.VITE_APP_ENV !== "test") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-3 left-1/2 z-[100] -translate-x-1/2"
    >
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-lg ring-1 ring-amber-600/40">
        <FlaskConical className="h-3.5 w-3.5" />
        Ambiente de testes · dados locais, isolados da produção
      </span>
    </div>
  );
}
