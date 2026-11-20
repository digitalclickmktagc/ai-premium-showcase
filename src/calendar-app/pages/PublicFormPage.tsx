import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileX2, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import EmptyState from "../components/EmptyState";
import { getDataService } from "../services";
import { rangeOf, validateAnswers } from "../forms";
import type { BriefingForm, FormAnswerValue, PublicForm } from "../types";

/**
 * The page whoever answers a briefing sees (benchmark ficha 17, F17b).
 *
 * It is anonymous by design: it never shows other people's answers, and the
 * adapter it talks to has no access to them either.
 */
export default function PublicFormPage() {
  const { token = "" } = useParams();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, FormAnswerValue>>({});
  const [respondent, setRespondent] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getDataService()
      .getPublicForm(token)
      .then((result) => alive && setForm(result))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  // validateAnswers works on the full form shape; the public payload has the
  // questions, which is all the validation reads.
  const asForm = useMemo(
    () => (form ? ({ ...form, questions: form.questions } as unknown as BriefingForm) : null),
    [form],
  );

  async function submit() {
    if (!asForm) return;
    const problems = validateAnswers(asForm, answers);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    setSending(true);
    const result = await getDataService().submitForm(token, answers, respondent);
    setSending(false);
    if (result.ok) {
      setSent(true);
      return;
    }
    setErrors({ __form: result.reason ?? "Não deu para enviar." });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <EmptyState
          icon={<FileX2 className="h-8 w-8" />}
          title="Formulário indisponível"
          description="Este endereço não está ativo. Peça um link novo a quem te enviou."
        />
      </div>
    );
  }

  if (sent) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
          title="Respostas enviadas"
          description="Obrigado! A equipe já consegue ver o que você respondeu."
        />
      </div>
    );
  }

  const set = (id: string, value: FormAnswerValue) =>
    setAnswers((a) => ({ ...a, [id]: value }));

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <header>
          <h1 className="font-display text-xl font-bold">{form.title}</h1>
          {form.description && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {form.description}
            </p>
          )}
        </header>

        <div className="grid gap-1.5">
          <Label htmlFor="resp-name">Seu nome (opcional)</Label>
          <Input
            id="resp-name"
            value={respondent}
            onChange={(e) => setRespondent(e.target.value)}
          />
        </div>

        {form.questions.map((q) => {
          const range = rangeOf(q);
          const value = answers[q.id];
          const error = errors[q.id];
          return (
            <div key={q.id} className="rounded-xl border border-border bg-card p-3">
              <Label htmlFor={`q-${q.id}`} className="text-sm">
                {q.label}
                {q.required && <span className="text-destructive"> *</span>}
              </Label>
              {q.hint && <p className="text-[11px] text-muted-foreground">{q.hint}</p>}

              <div className="mt-2">
                {q.kind === "texto" && (
                  <Input
                    id={`q-${q.id}`}
                    value={String(value ?? "")}
                    onChange={(e) => set(q.id, e.target.value)}
                  />
                )}

                {q.kind === "texto_longo" && (
                  <Textarea
                    id={`q-${q.id}`}
                    value={String(value ?? "")}
                    onChange={(e) => set(q.id, e.target.value)}
                    className="min-h-24"
                  />
                )}

                {q.kind === "data" && (
                  <Input
                    id={`q-${q.id}`}
                    type="date"
                    value={String(value ?? "")}
                    onChange={(e) => set(q.id, e.target.value)}
                  />
                )}

                {q.kind === "estrelas" && (
                  <div className="flex gap-1" role="group" aria-labelledby={`q-${q.id}`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`${n} estrela(s)`}
                        onClick={() => set(q.id, n)}
                        className="p-1"
                      >
                        <Star
                          className={cn(
                            "h-6 w-6",
                            Number(value) >= n
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/40",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                )}

                {(q.kind === "nota10" || q.kind === "escala") && range && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i).map(
                      (n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => set(q.id, n)}
                          className={cn(
                            "h-9 w-9 rounded-lg border text-sm tabular-nums transition-colors",
                            Number(value) === n
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-foreground/[0.04]",
                          )}
                        >
                          {n}
                        </button>
                      ),
                    )}
                  </div>
                )}

                {q.kind === "simnao" && (
                  <div className="flex gap-2">
                    {["Sim", "Não"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => set(q.id, option)}
                        className={cn(
                          "rounded-lg border px-4 py-1.5 text-sm transition-colors",
                          value === option
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-foreground/[0.04]",
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {q.kind === "lista" && (
                  <div className="space-y-1">
                    {(q.options ?? []).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => set(q.id, option)}
                        className={cn(
                          "block w-full rounded-lg border px-3 py-1.5 text-left text-sm transition-colors",
                          value === option
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-foreground/[0.04]",
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {q.kind === "multipla" && (
                  <div className="space-y-1">
                    {(q.options ?? []).map((option) => {
                      const chosen = Array.isArray(value) ? value : [];
                      return (
                        <label
                          key={option}
                          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm"
                        >
                          <Checkbox
                            checked={chosen.includes(option)}
                            onCheckedChange={(on) =>
                              set(
                                q.id,
                                on ? [...chosen, option] : chosen.filter((c) => c !== option),
                              )
                            }
                          />
                          {option}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
            </div>
          );
        })}

        {errors.__form && <p className="text-sm text-destructive">{errors.__form}</p>}

        <Button className="w-full" disabled={sending} onClick={() => void submit()}>
          {sending ? "Enviando..." : "Enviar respostas"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Suas respostas vão apenas para quem enviou o link.
        </p>
      </main>
    </div>
  );
}
