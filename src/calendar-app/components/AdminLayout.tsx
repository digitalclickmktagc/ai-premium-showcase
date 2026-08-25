import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useApp } from "../store/AppProvider";
import { initials } from "../utils";
import ClientFormDialog from "./ClientFormDialog";

function NavContent({
  activeClientId,
  onNavigate,
  onNewClient,
}: {
  activeClientId?: string;
  onNavigate?: () => void;
  onNewClient: () => void;
}) {
  const { clients, getCalendarByClient, session, logout } = useApp();
  const navigate = useNavigate();

  const sorted = useMemo(
    () =>
      [...clients].sort(
        (a, b) =>
          Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
      ),
    [clients],
  );

  const go = (path: string) => {
    onNavigate?.();
    navigate(path);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-nexa shadow-[var(--glow-sm)]">
          <CalendarDays className="h-5 w-5 text-white" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold">Calendário Editorial</p>
          <p className="text-[11px] text-muted-foreground">Painel da agência</p>
        </div>
      </div>

      <div className="px-3">
        <button
          onClick={() => go("/app")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            !activeClientId
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          Todos os clientes
        </button>
      </div>

      {/* Clients */}
      <div className="mt-4 flex items-center justify-between px-5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Clientes
        </span>
        <span className="text-[11px] text-muted-foreground">{clients.length}</span>
      </div>

      <nav className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {sorted.map((client) => {
          const cal = getCalendarByClient(client.id);
          if (!cal) return null;
          const active = activeClientId === client.id;
          return (
            <button
              key={client.id}
              onClick={() => go(`/app/calendars/${cal.id}`)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                active
                  ? "bg-white/[0.07] text-foreground"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                !client.active && "opacity-60",
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: client.color }}
              />
              <span className="truncate">{client.name}</span>
              {!client.active && (
                <span className="ml-auto shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                  inativo
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={() => {
            onNavigate?.();
            onNewClient();
          }}
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Novo cliente
        </button>
      </nav>

      {/* Footer / account */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            {initials(session?.name ?? "A")}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium">{session?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{session?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Sair"
            onClick={() => {
              logout();
              go("/app/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
  activeClientId,
  title,
}: {
  children: ReactNode;
  activeClientId?: string;
  title?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="ce-app min-h-[100dvh] bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card/40 lg:block">
        <NavContent
          activeClientId={activeClientId}
          onNewClient={() => setNewClientOpen(true)}
        />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Menu">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <NavContent
              activeClientId={activeClientId}
              onNavigate={() => setSheetOpen(false)}
              onNewClient={() => setNewClientOpen(true)}
            />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold">
            {title ?? "Calendário Editorial"}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>

      <ClientFormDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        onCreated={({ calendarId }) => navigate(`/app/calendars/${calendarId}`)}
      />
    </div>
  );
}
