import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Eye,
  EyeOff,
  Link2,
  Link2Off,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import AdminLayout from "../components/AdminLayout";
import EmptyState from "../components/EmptyState";
import ShareLink from "../components/ShareLink";
import { useApp } from "../store/AppProvider";
import {
  SECTION_KIND_LABEL,
  buildImage,
  completeness,
  defaultTemplate,
  flipVisibility,
  internalCount,
  moveSection,
  newSection,
  sectionOf,
  setSection,
  startDossier,
  validateTemplate,
} from "../dossier";
import type {
  Dossier,
  DossierSection,
  DossierSectionDef,
  DossierTemplate,
} from "../types";
import { shareToken } from "../utils";

/**
 * Dossiê estratégico (benchmark ficha 16), with the fix its own critique
 * asks for: the sections are a model the agency edits, not eight names
 * frozen in the code.
 */
export default function DossierPage() {
  const {
    clients,
    dossierTemplates,
    dossiers,
    saveDossierTemplate,
    saveDossier,
  } = useApp();

  const active = clients.filter((c) => c.status !== "archived");
  const [clientId, setClientId] = useState(active[0]?.id ?? "");
  useEffect(() => {
    if (!clientId && active[0]) setClientId(active[0].id);
  }, [clientId, active]);

  const template = dossierTemplates[0];
  const dossier = useMemo(
    () => dossiers.find((d) => d.clientId === clientId),
    [dossiers, clientId],
  );

  if (active.length === 0) {
    return (
      <AdminLayout section="dossie" title="Dossiê">
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="Nenhum cliente ainda"
          description="O dossiê é a estratégia de um cliente. Cadastre o primeiro."
        />
      </AdminLayout>
    );
  }

  if (!template) {
    return (
      <AdminLayout section="dossie" title="Dossiê">
        <EmptyState
          icon={<Settings2 className="h-8 w-8" />}
          title="Monte o modelo da agência"
          description="As seções do dossiê são suas: comece pelas oito do padrão e mude o que quiser — tirar, renomear, acrescentar."
          action={
            <Button
              onClick={async () => {
                await saveDossierTemplate(defaultTemplate());
                toast.success("Modelo criado.");
              }}
            >
              Criar o modelo padrão
            </Button>
          }
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout section="dossie" title="Dossiê">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Dossiê estratégico</h1>
          <p className="text-xs text-muted-foreground">
            A estratégia da marca em um lugar só, com link de leitura para o cliente.
          </p>
        </div>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="h-9 w-[200px]" aria-label="Cliente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {active.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <Tabs defaultValue="dossie">
        <TabsList>
          <TabsTrigger value="dossie" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Dossiê
          </TabsTrigger>
          <TabsTrigger value="modelo" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" /> Modelo da agência
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dossie" className="mt-4">
          {!dossier ? (
            <EmptyState
              icon={<BookOpen className="h-8 w-8" />}
              title="Sem dossiê para este cliente"
              description="Abra o dossiê para registrar persona, posicionamento, concorrentes e o resto do modelo."
              action={
                <Button
                  onClick={async () => {
                    await saveDossier(startDossier(clientId, template));
                    toast.success("Dossiê aberto.");
                  }}
                >
                  Abrir dossiê
                </Button>
              }
            />
          ) : (
            <DossierEditor
              dossier={dossier}
              template={template}
              onSave={saveDossier}
            />
          )}
        </TabsContent>

        <TabsContent value="modelo" className="mt-4">
          <TemplateEditor template={template} onSave={saveDossierTemplate} />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function DossierEditor({
  dossier,
  template,
  onSave,
}: {
  dossier: Dossier;
  template: DossierTemplate;
  onSave: (d: Dossier) => Promise<Dossier>;
}) {
  const filled = completeness(dossier, template);
  const hidden = internalCount(dossier, template);

  const patch = async (next: Dossier) => {
    await onSave(next);
  };

  const write = (def: DossierSectionDef, section: DossierSection) =>
    patch(setSection(dossier, section));

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="min-w-[180px] flex-1">
          <p className="text-xs text-muted-foreground">
            {filled}% do modelo preenchido — {template.sections.length} seções, contando como
            preenchida toda seção com qualquer conteúdo.
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div className="h-full rounded-full bg-primary" style={{ width: `${filled}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dossier.shareEnabled && dossier.shareToken ? (
            <>
              <ShareLink token={dossier.shareToken} basePath="/estrategia" compact />
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => void patch({ ...dossier, shareEnabled: false })}
              >
                <Link2Off className="h-3.5 w-3.5" /> Pausar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                void patch({
                  ...dossier,
                  shareToken: dossier.shareToken ?? shareToken(),
                  shareEnabled: true,
                })
              }
            >
              <Link2 className="h-3.5 w-3.5" /> Gerar link do cliente
            </Button>
          )}
        </div>
      </section>

      {hidden > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {hidden} seção(ões) marcada(s) como interna(s) — ficam fora do link do cliente. O
          raio-X nasce assim de propósito: anotação honesta vale mais que anotação diplomática.
        </p>
      )}

      {template.sections.map((def) => {
        const section = sectionOf(dossier, def);
        const isClient = section.visibility === "cliente";
        return (
          <section key={def.id} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-semibold">{def.title}</h2>
                {def.hint && <p className="text-[11px] text-muted-foreground">{def.hint}</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className={cn("h-7 gap-1 px-2 text-[11px]", !isClient && "text-amber-600")}
                onClick={() =>
                  void write(def, { ...section, visibility: flipVisibility(section.visibility) })
                }
              >
                {isClient ? (
                  <>
                    <Eye className="h-3.5 w-3.5" /> o cliente vê
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3.5 w-3.5" /> só interno
                  </>
                )}
              </Button>
            </div>

            {def.kind === "texto" && (
              <Textarea
                aria-label={def.title}
                defaultValue={section.text ?? ""}
                onBlur={(e) => void write(def, { ...section, text: e.target.value })}
                className="min-h-24"
              />
            )}

            {def.kind === "campos" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {(def.fields ?? []).map((field) => (
                  <div key={field.id} className="grid gap-1">
                    <Label htmlFor={`${def.id}-${field.id}`} className="text-[11px]">
                      {field.label}
                    </Label>
                    <Input
                      id={`${def.id}-${field.id}`}
                      defaultValue={section.values?.[field.id] ?? ""}
                      onBlur={(e) =>
                        void write(def, {
                          ...section,
                          values: { ...(section.values ?? {}), [field.id]: e.target.value },
                        })
                      }
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
            )}

            {def.kind === "lista" && (
              <ListField
                items={section.list ?? []}
                label={def.title}
                onChange={(list) => void write(def, { ...section, list })}
              />
            )}

            {def.kind === "tabela" && (
              <TableField
                def={def}
                rows={section.rows ?? []}
                onChange={(rows) => void write(def, { ...section, rows })}
              />
            )}

            {def.kind === "imagens" && (
              <ImagesField
                images={section.images ?? []}
                label={def.title}
                onChange={(images) => void write(def, { ...section, images })}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

function ListField({
  items,
  label,
  onChange,
}: {
  items: string[];
  label: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((line, i) => (
        <div key={i} className="flex gap-2">
          <Input
            defaultValue={line}
            aria-label={`${label} ${i + 1}`}
            onBlur={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            className="h-9"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={`Remover ${label} ${i + 1}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onChange([...items, ""])}>
        <Plus className="h-3.5 w-3.5" /> Linha
      </Button>
    </div>
  );
}

function TableField({
  def,
  rows,
  onChange,
}: {
  def: DossierSectionDef;
  rows: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
}) {
  const fields = def.fields ?? [];
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f.id} className="pb-1 pr-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {fields.map((f) => (
                  <td key={f.id} className="pb-2 pr-2">
                    <Input
                      defaultValue={row[f.id] ?? ""}
                      aria-label={`${f.label} ${i + 1}`}
                      onBlur={(e) =>
                        onChange(
                          rows.map((r, j) => (j === i ? { ...r, [f.id]: e.target.value } : r)),
                        )
                      }
                      className="h-9 min-w-[8rem]"
                    />
                  </td>
                ))}
                <td className="pb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    aria-label={`Remover linha ${i + 1}`}
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onChange([...rows, {}])}>
        <Plus className="h-3.5 w-3.5" /> Linha
      </Button>
    </div>
  );
}

function ImagesField({
  images,
  label,
  onChange,
}: {
  images: { id: string; url: string; caption?: string }[];
  label: string;
  onChange: (images: { id: string; url: string; caption?: string }[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((img) => (
            <figure key={img.id} className="space-y-1">
              <img
                src={img.url}
                alt={img.caption ?? ""}
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
              <figcaption className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                <span className="truncate">{img.caption ?? "sem legenda"}</span>
                <button
                  type="button"
                  aria-label={`Remover imagem ${img.caption ?? img.id}`}
                  onClick={() => onChange(images.filter((x) => x.id !== img.id))}
                  className="shrink-0 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          aria-label={`Endereço da imagem em ${label}`}
          className="h-9 flex-1"
        />
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Legenda (opcional)"
          aria-label={`Legenda da imagem em ${label}`}
          className="h-9 sm:w-48"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const img = buildImage(url, caption);
            if (!img) return toast.error("Informe um endereço http(s) válido.");
            onChange([...images, img]);
            setUrl("");
            setCaption("");
          }}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function TemplateEditor({
  template,
  onSave,
}: {
  template: DossierTemplate;
  onSave: (t: DossierTemplate) => Promise<DossierTemplate>;
}) {
  const [draft, setDraft] = useState(template);
  useEffect(() => setDraft(template), [template]);
  const problem = validateTemplate(draft);

  const setSections = (sections: DossierSectionDef[]) => setDraft((d) => ({ ...d, sections }));
  const patchSection = (id: string, patch: Partial<DossierSectionDef>) =>
    setSections(draft.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          aria-label="Nome do modelo"
          className="h-9 w-56"
        />
        <Button
          disabled={!!problem}
          onClick={async () => {
            await onSave(draft);
            toast.success("Modelo salvo.");
          }}
        >
          Salvar modelo
        </Button>
        {problem && <span className="text-xs text-destructive">{problem}</span>}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Mudar o modelo vale para todos os clientes. Tirar uma seção não apaga o que já foi
        escrito nela: o conteúdo fica guardado e volta se a seção voltar.
      </p>

      {draft.sections.map((section, idx) => (
        <section key={section.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={section.title}
              onChange={(e) => patchSection(section.id, { title: e.target.value })}
              aria-label={`Título da seção ${idx + 1}`}
              placeholder="Nome da seção"
              className="h-9 flex-1 min-w-[12rem]"
            />
            <Select
              value={section.kind}
              onValueChange={(v) =>
                patchSection(section.id, {
                  kind: v as DossierSectionDef["kind"],
                  fields:
                    v === "campos" || v === "tabela"
                      ? (section.fields ?? [{ id: crypto.randomUUID(), label: "" }])
                      : undefined,
                })
              }
            >
              <SelectTrigger className="h-9 w-[150px]" aria-label={`Tipo da seção ${idx + 1}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SECTION_KIND_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              className={cn("h-9 gap-1 px-2 text-[11px]", section.defaultVisibility === "interno" && "text-amber-600")}
              onClick={() =>
                patchSection(section.id, {
                  defaultVisibility: flipVisibility(section.defaultVisibility),
                })
              }
            >
              {section.defaultVisibility === "cliente" ? (
                <>
                  <Eye className="h-3.5 w-3.5" /> nasce visível
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> nasce interna
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={`Subir seção ${idx + 1}`}
              onClick={() => setSections(moveSection(draft.sections, section.id, -1))}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={`Descer seção ${idx + 1}`}
              onClick={() => setSections(moveSection(draft.sections, section.id, 1))}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={`Remover seção ${idx + 1}`}
              onClick={() => setSections(draft.sections.filter((s) => s.id !== section.id))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {(section.kind === "campos" || section.kind === "tabela") && (
            <div className="mt-2 space-y-1.5 pl-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {section.kind === "tabela" ? "Colunas" : "Campos"}
              </p>
              {(section.fields ?? []).map((field, fIdx) => (
                <div key={field.id} className="flex gap-2">
                  <Input
                    value={field.label}
                    onChange={(e) =>
                      patchSection(section.id, {
                        fields: (section.fields ?? []).map((f) =>
                          f.id === field.id ? { ...f, label: e.target.value } : f,
                        ),
                      })
                    }
                    aria-label={`Campo ${fIdx + 1} da seção ${idx + 1}`}
                    className="h-8 max-w-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Remover campo ${fIdx + 1} da seção ${idx + 1}`}
                    onClick={() =>
                      patchSection(section.id, {
                        fields: (section.fields ?? []).filter((f) => f.id !== field.id),
                      })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-[11px]"
                onClick={() =>
                  patchSection(section.id, {
                    fields: [...(section.fields ?? []), { id: crypto.randomUUID(), label: "" }],
                  })
                }
              >
                <Plus className="h-3 w-3" /> Campo
              </Button>
            </div>
          )}
        </section>
      ))}

      <Button
        variant="outline"
        className="gap-1.5"
        onClick={() => setSections([...draft.sections, newSection()])}
      >
        <Plus className="h-3.5 w-3.5" /> Seção
      </Button>
    </div>
  );
}
