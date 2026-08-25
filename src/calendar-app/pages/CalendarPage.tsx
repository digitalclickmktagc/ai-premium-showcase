import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { startOfMonth } from "date-fns";
import { CalendarX2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Post, PostStatus } from "../types";
import { ALL_STATUSES, statusConfig } from "../status";
import { initials } from "../utils";
import { useApp } from "../store/AppProvider";
import AdminLayout from "../components/AdminLayout";
import MonthGrid from "../components/MonthGrid";
import MonthNavigator from "../components/MonthNavigator";
import PostModal from "../components/PostModal";
import ShareLink from "../components/ShareLink";
import StatusLegend from "../components/StatusLegend";
import EmptyState from "../components/EmptyState";

export default function CalendarPage() {
  const { calendarId = "" } = useParams();
  const navigate = useNavigate();
  const { getCalendar, getClientForCalendar, postsForCalendar, regenerateShareToken } =
    useApp();

  const calendar = getCalendar(calendarId);
  const client = getClientForCalendar(calendarId);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showDeleted, setShowDeleted] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [createDate, setCreateDate] = useState<string | undefined>();

  const allPosts = useMemo(
    () => (calendar ? postsForCalendar(calendar.id, { includeDeleted: true }) : []),
    [calendar, postsForCalendar],
  );

  const contentTypes = useMemo(() => {
    const set = new Set<string>();
    allPosts.forEach((p) => p.contentType && set.add(p.contentType));
    return [...set].sort();
  }, [allPosts]);

  const visiblePosts = useMemo(() => {
    if (!calendar) return [];
    return postsForCalendar(calendar.id, {
      includeDeleted: showDeleted,
      status: statusFilter,
      contentType: typeFilter,
    });
  }, [calendar, postsForCalendar, showDeleted, statusFilter, typeFilter]);

  if (!calendar || !client) {
    return (
      <AdminLayout>
        <EmptyState
          icon={<CalendarX2 className="h-10 w-10" />}
          title="Calendário não encontrado"
          description="Este calendário pode ter sido removido ou o link está incorreto."
          action={<Button onClick={() => navigate("/app")}>Voltar ao painel</Button>}
        />
      </AdminLayout>
    );
  }

  const openCreate = (date?: string) => {
    setEditingPost(null);
    setCreateDate(date);
    setModalOpen(true);
  };
  const openEdit = (post: Post) => {
    setEditingPost(post);
    setCreateDate(undefined);
    setModalOpen(true);
  };

  return (
    <AdminLayout activeClientId={client.id} title={client.name}>
      {/* Client header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
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
              style={{ backgroundColor: client.color }}
            >
              {initials(client.name)}
            </div>
          )}
          <div>
            <h1 className="font-display text-xl font-bold sm:text-2xl">{client.name}</h1>
            <p className="text-xs text-muted-foreground">
              {client.handle ? `${client.handle} · ` : ""}
              {calendar.name}
            </p>
          </div>
        </div>
        <Button onClick={() => openCreate()} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo post
        </Button>
      </div>

      {/* Share link */}
      <div className="mb-5 rounded-xl border border-border bg-card/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Link de compartilhamento do cliente
          </p>
        </div>
        <ShareLink
          token={calendar.shareToken}
          onRegenerate={async () => {
            if (
              window.confirm(
                "Gerar um novo link invalida o link anterior enviado ao cliente. Continuar?",
              )
            ) {
              await regenerateShareToken(calendar.id);
            }
          }}
        />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonthNavigator month={month} onChange={setMonth} />
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as PostStatus | "all")}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusConfig(s).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {contentTypes.length > 0 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {contentTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2">
            <Switch
              id="show-deleted"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
            />
            <Label htmlFor="show-deleted" className="cursor-pointer text-xs text-muted-foreground">
              Mostrar deletados
            </Label>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <MonthGrid
        month={month}
        posts={visiblePosts}
        accentColor={client.color}
        onPostClick={openEdit}
        onDayClick={openCreate}
      />

      <div className="mt-4">
        <StatusLegend />
      </div>

      <PostModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        post={editingPost}
        calendarId={calendar.id}
        defaultDate={createDate}
      />
    </AdminLayout>
  );
}
