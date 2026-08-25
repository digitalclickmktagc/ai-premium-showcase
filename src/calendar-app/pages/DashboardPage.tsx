import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSameMonth } from "date-fns";
import {
  CalendarPlus,
  Circle,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Client } from "../types";
import { fromDayISO, initials } from "../utils";
import { useApp } from "../store/AppProvider";
import AdminLayout from "../components/AdminLayout";
import ClientFormDialog from "../components/ClientFormDialog";
import ShareLink from "../components/ShareLink";
import EmptyState from "../components/EmptyState";

export default function DashboardPage() {
  const { clients, calendars, posts, getCalendarByClient, postsForCalendar } = useApp();
  const navigate = useNavigate();

  const [newOpen, setNewOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const sorted = useMemo(
    () =>
      [...clients].sort(
        (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
      ),
    [clients],
  );

  const stats = useMemo(() => {
    const now = new Date();
    const active = posts.filter((p) => p.status !== "deleted");
    const thisMonth = active.filter((p) => isSameMonth(fromDayISO(p.date), now));
    return {
      clients: clients.length,
      activeClients: clients.filter((c) => c.active).length,
      monthPosts: thisMonth.length,
      published: active.filter((p) => p.status === "published").length,
    };
  }, [clients, posts]);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os calendários editoriais de cada cliente.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Clientes" value={stats.clients} />
        <StatCard label="Ativos" value={stats.activeClients} />
        <StatCard label="Posts no mês" value={stats.monthPosts} />
        <StatCard label="Publicados" value={stats.published} />
      </div>

      {/* Client grid */}
      {clients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Nenhum cliente ainda"
          description="Crie seu primeiro cliente para começar a montar o calendário editorial."
          action={
            <Button onClick={() => setNewOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Criar cliente
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((client) => {
            const cal = getCalendarByClient(client.id);
            if (!cal) return null;
            const clientPosts = postsForCalendar(cal.id);
            const upcoming = [...clientPosts]
              .filter((p) => p.date >= new Date().toISOString().slice(0, 10))
              .sort((a, b) => a.date.localeCompare(b.date))[0];

            return (
              <div
                key={client.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/50 transition-colors hover:border-primary/30"
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: client.color }} />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start gap-3">
                    <Avatar client={client} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-base font-semibold">
                          {client.name}
                        </h3>
                        {!client.active && (
                          <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                            inativo
                          </span>
                        )}
                      </div>
                      {client.handle && (
                        <p className="truncate text-xs text-muted-foreground">
                          {client.handle}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => setEditClient(client)}
                      title="Editar cliente"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Circle className="h-3 w-3" style={{ color: client.color }} />
                      {clientPosts.length} {clientPosts.length === 1 ? "post" : "posts"}
                    </span>
                    {upcoming && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Próx.: {upcoming.date.slice(8, 10)}/{upcoming.date.slice(5, 7)}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      className="flex-1"
                      size="sm"
                      onClick={() => navigate(`/app/calendars/${cal.id}`)}
                    >
                      Abrir calendário
                    </Button>
                    <ShareLink token={cal.shareToken} compact />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ClientFormDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={({ calendarId }) => navigate(`/app/calendars/${calendarId}`)}
      />
      <ClientFormDialog
        open={Boolean(editClient)}
        onOpenChange={(o) => !o && setEditClient(null)}
        client={editClient ?? undefined}
      />
    </AdminLayout>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Avatar({ client }: { client: Client }) {
  if (client.logoUrl) {
    return (
      <img
        src={client.logoUrl}
        alt={client.name}
        className="h-10 w-10 shrink-0 rounded-xl object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
      style={{ backgroundColor: client.color }}
    >
      {initials(client.name)}
    </div>
  );
}
