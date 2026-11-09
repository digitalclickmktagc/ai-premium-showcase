import { useState, type KeyboardEvent } from "react";
import {
  CheckSquare,
  Clock,
  ExternalLink,
  Lock,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Post } from "../types";
import {
  buildAttachment,
  checklistProgress,
  formatDuration,
  newChecklistItem,
  newComment,
  newTimeEntry,
  parseDuration,
  sortComments,
  toggleChecklistItem,
  totalMinutes,
  validateChecklistText,
  validateComment,
  validateDuration,
} from "../cards";
import { formatTimestamp } from "../utils";
import { useApp } from "../store/AppProvider";

/**
 * The card's production workspace (benchmark spec 02): checklist, internal
 * comments, attachments and logged time.
 *
 * Everything here saves the moment you act, not when the modal's Save button
 * is pressed. A comment you typed and a box you ticked are facts, and losing
 * them to a Cancel click would be the wrong kind of surprise.
 *
 * All four are internal. None of them reaches the client's share view —
 * enforced in the adapters and proved by supabase/verificacao-seguranca.sql.
 */
/** Enter submits the row it belongs to, from any field in it. */
const onEnter =
  (run: () => void) => (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    run();
  };

export default function CardWorkspace({ post }: { post: Post }) {
  const { updatePost, session } = useApp();
  const [busy, setBusy] = useState(false);

  const checklist = post.checklist ?? [];
  const comments = post.comments ?? [];
  const attachments = post.attachments ?? [];
  const timeEntries = post.timeEntries ?? [];
  const progress = checklistProgress(checklist);
  const logged = totalMinutes(timeEntries);

  const [itemText, setItemText] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [attName, setAttName] = useState("");
  const [attUrl, setAttUrl] = useState("");
  const [duration, setDuration] = useState("");
  const [timeNote, setTimeNote] = useState("");

  /** One save path for every section, so failures read the same way. */
  const persist = async (patch: Parameters<typeof updatePost>[1], onDone?: () => void) => {
    setBusy(true);
    try {
      await updatePost(post.id, patch);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  // ── checklist ──
  const addItem = () => {
    const invalid = validateChecklistText(itemText);
    if (invalid) return toast.error(invalid);
    void persist({ checklist: [...checklist, newChecklistItem(itemText)] }, () =>
      setItemText(""),
    );
  };

  // ── comments ──
  const addComment = () => {
    const invalid = validateComment(commentBody);
    if (invalid) return toast.error(invalid);
    const author = session?.name || session?.email || "Equipe";
    void persist({ comments: [...comments, newComment(commentBody, author)] }, () =>
      setCommentBody(""),
    );
  };

  // ── attachments ──
  const addAttachment = () => {
    const res = buildAttachment(attName, attUrl);
    if ("error" in res) return toast.error(res.error);
    void persist({ attachments: [...attachments, res.attachment] }, () => {
      setAttName("");
      setAttUrl("");
    });
  };

  // ── time ──
  const addTime = () => {
    const invalid = validateDuration(duration);
    if (invalid) return toast.error(invalid);
    const minutes = parseDuration(duration)!;
    void persist({ timeEntries: [...timeEntries, newTimeEntry(minutes, timeNote)] }, () => {
      setDuration("");
      setTimeNote("");
    });
  };

  const count = (n: number) =>
    n > 0 ? (
      <span className="ml-1 rounded-full bg-foreground/[0.08] px-1.5 text-[10px] leading-4">
        {n}
      </span>
    ) : null;

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <Lock className="h-3.5 w-3.5 text-amber-500" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Produção — só a agência vê
        </p>
      </div>

      <Tabs defaultValue="checklist" className="p-3">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="checklist" className="text-xs">
            <CheckSquare className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Checklist</span>
            {count(checklist.length)}
          </TabsTrigger>
          <TabsTrigger value="comentarios" className="text-xs">
            <MessageSquare className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Comentários</span>
            {count(comments.length)}
          </TabsTrigger>
          <TabsTrigger value="anexos" className="text-xs">
            <Paperclip className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Anexos</span>
            {count(attachments.length)}
          </TabsTrigger>
          <TabsTrigger value="tempo" className="text-xs">
            <Clock className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Tempo</span>
            {logged > 0 && (
              <span className="ml-1 rounded-full bg-foreground/[0.08] px-1.5 text-[10px] leading-4">
                {formatDuration(logged)}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Checklist ── */}
        <TabsContent value="checklist" className="mt-3 space-y-2">
          {checklist.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    progress.complete ? "bg-emerald-500" : "bg-primary",
                  )}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {progress.done}/{progress.total}
              </span>
            </div>
          )}

          <ul className="space-y-1">
            {checklist.map((item) => (
              <li key={item.id} className="group flex items-start gap-2">
                <Checkbox
                  id={`chk-${item.id}`}
                  checked={item.done}
                  disabled={busy}
                  onCheckedChange={() =>
                    void persist({ checklist: toggleChecklistItem(checklist, item.id) })
                  }
                  className="mt-0.5"
                />
                <label
                  htmlFor={`chk-${item.id}`}
                  className={cn(
                    "flex-1 cursor-pointer text-sm leading-snug",
                    item.done && "text-muted-foreground line-through",
                  )}
                >
                  {item.text}
                </label>
                <button
                  type="button"
                  aria-label="Remover item"
                  onClick={() =>
                    void persist({
                      checklist: checklist.filter((i) => i.id !== item.id),
                    })
                  }
                  className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <Input
              value={itemText}
              onChange={(e) => setItemText(e.target.value)}
              onKeyDown={onEnter(addItem)}
              placeholder="Gravar, editar, legendar..."
              aria-label="Novo item do checklist"
              className="h-9"
            />
            <Button size="sm" variant="outline" onClick={addItem} disabled={busy}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TabsContent>

        {/* ── Comentários ── */}
        <TabsContent value="comentarios" className="mt-3 space-y-2">
          <Textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Combinar algo com a equipe sobre este post..."
            aria-label="Novo comentário interno"
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={addComment} disabled={busy}>
              Comentar
            </Button>
          </div>

          {comments.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground/70">
              Nenhum comentário ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortComments(comments).map((c) => (
                <li key={c.id} className="group rounded-lg border border-border bg-muted p-2.5">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">{c.author}</span>
                    <span>{formatTimestamp(c.at)}</span>
                    <button
                      type="button"
                      aria-label="Remover comentário"
                      onClick={() =>
                        void persist({ comments: comments.filter((x) => x.id !== c.id) })
                      }
                      className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* ── Anexos ── */}
        <TabsContent value="anexos" className="mt-3 space-y-2">
          <ul className="space-y-1">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="group flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex-1 truncate text-sm text-primary hover:underline"
                  title={a.url}
                >
                  {a.name}
                </a>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  aria-label="Remover anexo"
                  onClick={() =>
                    void persist({ attachments: attachments.filter((x) => x.id !== a.id) })
                  }
                  className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <Input
              value={attName}
              onChange={(e) => setAttName(e.target.value)}
              onKeyDown={onEnter(addAttachment)}
              placeholder="Nome (opcional)"
              aria-label="Nome do anexo"
              className="h-9"
            />
            <Input
              value={attUrl}
              onChange={(e) => setAttUrl(e.target.value)}
              onKeyDown={onEnter(addAttachment)}
              placeholder="https://drive.google.com/..."
              aria-label="Endereço do anexo"
              className="h-9"
            />
            <Button size="sm" variant="outline" onClick={addAttachment} disabled={busy}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Anexos são links (Drive, Dropbox, Figma). Enviar o arquivo em si exige o
            Storage do Supabase, que ainda não está configurado.
          </p>
        </TabsContent>

        {/* ── Tempo ── */}
        <TabsContent value="tempo" className="mt-3 space-y-2">
          {logged > 0 && (
            <p className="text-sm">
              Total lançado:{" "}
              <strong className="font-semibold">{formatDuration(logged)}</strong>
            </p>
          )}

          <ul className="space-y-1">
            {[...timeEntries]
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((t) => (
                <li
                  key={t.id}
                  className="group flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{formatDuration(t.minutes)}</span>
                  {t.note && <span className="truncate text-muted-foreground">{t.note}</span>}
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                    {formatTimestamp(t.at)}
                  </span>
                  <button
                    type="button"
                    aria-label="Remover lançamento"
                    onClick={() =>
                      void persist({ timeEntries: timeEntries.filter((x) => x.id !== t.id) })
                    }
                    className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
          </ul>

          <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              onKeyDown={onEnter(addTime)}
              placeholder="1h30"
              className="h-9 sm:w-24"
              aria-label="Tempo gasto"
            />
            <Input
              value={timeNote}
              onChange={(e) => setTimeNote(e.target.value)}
              onKeyDown={onEnter(addTime)}
              placeholder="No que foi (opcional)"
              aria-label="No que o tempo foi gasto"
              className="h-9"
            />
            <Button size="sm" variant="outline" onClick={addTime} disabled={busy}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Aceita "90", "1h30" ou "1:30".
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
