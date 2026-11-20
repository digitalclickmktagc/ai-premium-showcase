import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileX2, Loader2 } from "lucide-react";
import EmptyState from "../components/EmptyState";
import { getDataService } from "../services";
import type { PublicDossier } from "../types";

/**
 * The client's read-only strategy page (benchmark ficha 16).
 *
 * It serves what the adapter returns and nothing else: on Supabase that is a
 * SECURITY DEFINER function the anonymous role reaches without any grant on
 * the table, so an internal section never leaves the database — this page
 * cannot leak what it was never given.
 */
export default function PublicDossierPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<PublicDossier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getDataService()
      .getPublicDossier(token)
      .then((result) => alive && setData(result))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <EmptyState
          icon={<FileX2 className="h-8 w-8" />}
          title="Página não encontrada"
          description="Este endereço não está disponível. Peça um link novo a quem cuida da sua conta."
        />
      </div>
    );
  }

  const { client, template, sections } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5">
          {client.logoUrl ? (
            <img
              src={client.logoUrl}
              alt=""
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: client.color }}
            >
              {client.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="font-display text-lg font-bold">{client.name}</h1>
            <p className="text-xs text-muted-foreground">{template.name}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {template.sections.length === 0 && (
          <p className="text-sm text-muted-foreground">
            A estratégia ainda está sendo escrita. Volte em breve.
          </p>
        )}
        {template.sections.map((def, index) => {
          const section = sections[index];
          if (!section) return null;
          return (
            <section key={def.id} className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-display text-base font-semibold">{def.title}</h2>
              {def.hint && <p className="mb-2 text-[11px] text-muted-foreground">{def.hint}</p>}
              <div className="mt-2 text-sm">
                {def.kind === "texto" && (
                  <p className="whitespace-pre-wrap leading-relaxed">{section.text}</p>
                )}

                {def.kind === "lista" && (
                  <ul className="list-disc space-y-1 pl-5">
                    {(section.list ?? [])
                      .filter((l) => l.trim())
                      .map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                  </ul>
                )}

                {def.kind === "campos" && (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {(def.fields ?? []).map((field) => {
                      const value = section.values?.[field.id]?.trim();
                      if (!value) return null;
                      return (
                        <div key={field.id}>
                          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {field.label}
                          </dt>
                          <dd className="whitespace-pre-wrap">{value}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}

                {def.kind === "tabela" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {(def.fields ?? []).map((f) => (
                            <th key={f.id} className="py-1.5 pr-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(section.rows ?? []).map((row, i) => (
                          <tr key={i} className="border-b border-border/60">
                            {(def.fields ?? []).map((f) => (
                              <td key={f.id} className="py-1.5 pr-3">
                                {row[f.id]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {def.kind === "imagens" && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(section.images ?? []).map((img) => (
                      <figure key={img.id} className="space-y-1">
                        <img
                          src={img.url}
                          alt={img.caption ?? ""}
                          loading="lazy"
                          className="aspect-square w-full rounded-lg border border-border object-cover"
                        />
                        {img.caption && (
                          <figcaption className="text-[11px] text-muted-foreground">
                            {img.caption}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-8 text-[11px] text-muted-foreground">
        Página de leitura. Para mudar algo, fale com quem cuida da sua conta.
      </footer>
    </div>
  );
}
