import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { startOfMonth } from "date-fns";
import { CalendarDays, Eye, Link2Off, Loader2 } from "lucide-react";
import type { PublicCalendarView, PublicPost } from "../types";
import { getDataService } from "../services";
import { initials } from "../utils";
import MonthGrid from "../components/MonthGrid";
import MonthNavigator from "../components/MonthNavigator";
import StatusLegend from "../components/StatusLegend";
import PostViewDialog from "../components/PostView";

type LoadState = "loading" | "ready" | "not-found";

export default function ClientViewPage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<LoadState>("loading");
  const [view, setView] = useState<PublicCalendarView | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<PublicPost | null>(null);
  const [open, setOpen] = useState(false);

  // Restore the real cursor (the landing page hides it globally).
  useEffect(() => {
    document.body.classList.add("calendar-route");
    return () => document.body.classList.remove("calendar-route");
  }, []);

  useEffect(() => {
    let active = true;
    setState("loading");
    getDataService()
      .getPublicView(token)
      .then((v) => {
        if (!active) return;
        setView(v);
        setState(v ? "ready" : "not-found");
      })
      .catch(() => active && setState("not-found"));
    return () => {
      active = false;
    };
  }, [token]);

  const accent = view?.client.color ?? "#8b5cf6";

  const posts = useMemo(() => view?.posts ?? [], [view]);

  if (state === "loading") {
    return (
      <div className="ce-app flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (state === "not-found" || !view) {
    return (
      <div className="ce-app flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-4 text-center text-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
          <Link2Off className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="font-display text-xl font-bold">Link inválido ou expirado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Este link de calendário não é mais válido. Solicite um novo link à
          agência responsável.
        </p>
      </div>
    );
  }

  const { client, calendar } = view;

  return (
    <div className="ce-app min-h-[100dvh] bg-background text-foreground">
      {/* Accent bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {client.logoUrl ? (
              <img
                src={client.logoUrl}
                alt={client.name}
                className="h-11 w-11 rounded-xl object-cover"
              />
            ) : (
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {initials(client.name)}
              </div>
            )}
            <div>
              <h1 className="font-display text-lg font-bold sm:text-xl">{client.name}</h1>
              <p className="text-xs text-muted-foreground">
                {client.handle ? `${client.handle} · ` : ""}
                Calendário editorial
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Somente leitura
          </span>
        </div>
      </header>

      {/* Calendar */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <MonthNavigator month={month} onChange={setMonth} />
          <div className="hidden sm:block">
            <StatusLegend />
          </div>
        </div>

        <MonthGrid
          month={month}
          posts={posts}
          accentColor={accent}
          readOnly
          onPostClick={(p) => {
            setSelected(p as PublicPost);
            setOpen(true);
          }}
        />

        <div className="mt-4 sm:hidden">
          <StatusLegend />
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Calendário de {client.name} · {calendar.name}
        </p>
      </main>

      <PostViewDialog
        open={open}
        onOpenChange={setOpen}
        post={selected}
        accentColor={accent}
      />
    </div>
  );
}
