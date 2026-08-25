import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Lock, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Post, PostStatus } from "../types";
import { statusConfig } from "../status";
import { formatLongDay, formatTimestamp, todayISO } from "../utils";
import { useApp } from "../store/AppProvider";
import { StatusPicker } from "./StatusBadge";
import { RescheduleHistory } from "./PostView";

const CONTENT_SUGGESTIONS = ["Feed", "Story", "Reels", "Carrossel", "Live", "Blog"];

/** Admin create/edit modal for a post. */
export default function PostModal({
  open,
  onOpenChange,
  post,
  calendarId,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: Post | null;
  calendarId?: string;
  defaultDate?: string;
}) {
  const app = useApp();
  const isEdit = Boolean(post);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<PostStatus>("todo");
  const [contentType, setContentType] = useState("");
  const [description, setDescription] = useState("");
  const [referenceLink, setReferenceLink] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(post?.title ?? "");
    setDate(post?.date ?? defaultDate ?? todayISO());
    setStatus(post?.status ?? "todo");
    setContentType(post?.contentType ?? "");
    setDescription(post?.description ?? "");
    setReferenceLink(post?.referenceLink ?? "");
    setInternalNotes(post?.internalNotes ?? "");
  }, [open, post, defaultDate]);

  const history = post?.rescheduleHistory ?? [];
  const cfg = statusConfig(post?.status ?? status);
  const isDeleted = post?.status === "deleted";
  const dateChanged = useMemo(
    () => isEdit && post?.date !== date,
    [isEdit, post?.date, date],
  );

  const save = async () => {
    if (!title.trim()) {
      toast.error("Informe o título do post.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && post) {
        await app.updatePost(post.id, {
          title,
          date,
          status,
          contentType,
          description,
          referenceLink,
          internalNotes,
        });
        toast.success(dateChanged ? "Post salvo e reagendado." : "Post atualizado.");
      } else if (calendarId) {
        await app.createPost({
          calendarId,
          title,
          date,
          status,
          contentType,
          description,
          referenceLink,
          internalNotes,
        });
        toast.success("Post criado.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar o post.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!post) return;
    try {
      await app.deletePost(post.id);
      onOpenChange(false);
      toast("Post movido para deletados.", {
        description: post.title,
        action: {
          label: "Desfazer",
          onClick: () => {
            app.restorePost(post.id, "todo").catch(() => undefined);
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao deletar.");
    }
  };

  const restore = async () => {
    if (!post) return;
    try {
      await app.restorePost(post.id, "todo");
      toast.success("Post restaurado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao restaurar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          "max-sm:h-[100dvh] max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
          "sm:max-h-[90vh] sm:max-w-xl",
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span
            className="mt-1 h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: cfg.color }}
          />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate pr-8 font-display text-lg">
              {isEdit ? "Detalhes do post" : "Novo post"}
            </DialogTitle>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatLongDay(date)}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="post-title">Título *</Label>
            <Input
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Novo blend de inverno"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="post-date">Data programada</Label>
              <Input
                id="post-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {dateChanged && (
                <p className="text-xs text-amber-300/80">
                  Alterar a data registra um reagendamento.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-type">Tipo de conteúdo</Label>
              <Input
                id="post-type"
                list="content-type-suggestions"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                placeholder="Feed, Story, Reels..."
              />
              <datalist id="content-type-suggestions">
                {CONTENT_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <StatusPicker value={status} onChange={setStatus} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-desc">Descrição / legenda</Label>
            <Textarea
              id="post-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Texto da legenda, roteiro, chamada..."
              rows={5}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-link">Link de referência / anexo</Label>
            <Input
              id="post-link"
              value={referenceLink}
              onChange={(e) => setReferenceLink(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-notes" className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              Observações internas
            </Label>
            <Textarea
              id="post-notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Visível apenas para a agência — nunca aparece para o cliente."
              rows={3}
              className="border-amber-500/20 bg-amber-500/[0.03]"
            />
            <p className="text-xs text-muted-foreground">
              Este campo é privado e não aparece na visão do cliente.
            </p>
          </div>

          {history.length > 0 && <RescheduleHistory history={history} />}

          {isEdit && post && (
            <p className="text-xs text-muted-foreground">
              Criado em {formatTimestamp(post.createdAt)} · Atualizado em{" "}
              {formatTimestamp(post.updatedAt)}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {isEdit &&
            (isDeleted ? (
              <Button variant="outline" onClick={restore} className="gap-1.5 text-emerald-300">
                <Undo2 className="h-4 w-4" /> Restaurar
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={remove}
                className="gap-1.5 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
              >
                <Trash2 className="h-4 w-4" /> Deletar
              </Button>
            ))}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
