import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CalendarRange,
  Handshake,
  BookOpen,
  ClipboardList,
  FolderKanban,
  Lightbulb,
  Plug,
  ListChecks,
  Sun,
  Target,
  Wrench,
  Wallet,
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
import { CLIENT_STATUS_LABEL, isOperational, normalizeStatus } from "../health";
import ClientFormDialog from "./ClientFormDialog";
import { ThemeToggle } from "../theme";

function NavContent({
  activeClientId,
  section,
  onNavigate,
  onNewClient,
}: {
  activeClientId?: string;
  /** Which top-level area is open, for pages that are not a client. */
  section?: "hoje" | "pauta" | "ideias" | "dossie" | "projetos" | "ferramentas" | "formularios" | "integracoes" | "agenda" | "comercial" | "financeiro" | "crm";
  onNavigate?: () => void;
  onNewClient: () => void;
}) {
  const { clients, getCalendarByClient, session, logout } = useApp();
  const navigate = useNavigate();

  const sorted = useMemo(
    () =>
      [...clients].sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          Number(isOperational(normalizeStatus(b))) -
            Number(isOperational(normalizeStatus(a))) ||
          a.name.localeCompare(b.name),
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
          onClick={() => go("/app/hoje")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "hoje"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <Sun className="h-4 w-4" />
          Hoje
        </button>
        <button
          onClick={() => go("/app")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            !activeClientId && !section
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          Todos os clientes
        </button>
        <button
          onClick={() => go("/app/crm")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "crm"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <Target className="h-4 w-4" />
          CRM
        </button>
        <button
          onClick={() => go("/app/comercial")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "comercial"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <Handshake className="h-4 w-4" />
          Comercial
        </button>
        <button
          onClick={() => go("/app/financeiro")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "financeiro"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <Wallet className="h-4 w-4" />
          Financeiro
        </button>
        <button
          onClick={() => go("/app/pauta")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "pauta"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <ClipboardList className="h-4 w-4" />
          Pauta
        </button>
        <button
          onClick={() => go("/app/ideias")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "ideias"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <Lightbulb className="h-4 w-4" />
          Ideias
        </button>
        <button
          onClick={() => go("/app/projetos")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "projetos"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <FolderKanban className="h-4 w-4" />
          Projetos
        </button>
        <button
          onClick={() => go("/app/dossie")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "dossie"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <BookOpen className="h-4 w-4" />
          Dossiê
        </button>
        <button
          onClick={() => go("/app/formularios")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "formularios"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <ListChecks className="h-4 w-4" />
          Formulários
        </button>
        <button
          onClick={() => go("/app/ferramentas")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "ferramentas"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <Wrench className="h-4 w-4" />
          Ferramentas
        </button>
        <button
          onClick={() => go("/app/integracoes")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "integracoes"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <Plug className="h-4 w-4" />
          Integrações
        </button>
        <button
          onClick={() => go("/app/agenda")}
          className={cn(
            "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            section === "agenda"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          )}
        >
          <CalendarRange className="h-4 w-4" />
          Agenda
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
                  ? "bg-foreground/[0.08] text-foreground"
                  : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                !isOperational(normalizeStatus(client)) && "opacity-60",
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: client.color }}
              />
              <span className="truncate">{client.name}</span>
              {normalizeStatus(client) !== "active" && (
                <span className="ml-auto shrink-0 rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                  {CLIENT_STATUS_LABEL[normalizeStatus(client)]}
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
          <ThemeToggle className="h-8 w-8" />
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
  section,
  title,
}: {
  children: ReactNode;
  activeClientId?: string;
  section?: "hoje" | "pauta" | "ideias" | "dossie" | "projetos" | "ferramentas" | "formularios" | "integracoes" | "agenda" | "comercial" | "financeiro" | "crm";
  title?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="ce-app min-h-[100dvh] bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:block">
        <NavContent
          activeClientId={activeClientId}
          section={section}
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
        <ThemeToggle className="ml-auto" />
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
