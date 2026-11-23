import { useEffect, useState } from "react";
import { Eye, EyeOff, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AI_ACTIONS } from "../ai";
import {
  DEFAULT_MODEL,
  readLocalConfig,
  writeLocalConfig,
  type LocalAiConfig,
} from "../services/aiClient";
import { useApp } from "../store/AppProvider";
import type { AiSettings } from "../types";

const FACTORY: AiSettings = {
  enabled: false,
  model: DEFAULT_MODEL,
  effort: "medium",
  dailyLimit: 100,
  allowed: [],
};

/**
 * Assistente de IA — o interruptor e o que ele controla (ficha 22).
 *
 * A ficha do benchmark descreve um assistente que conhece os guias do sistema,
 * e a avaliação da própria ficha diz que isso vale pouco. Aqui ele lê os dados
 * reais: o dia, a pauta, a análise, o financeiro, o CRM. Em troca disso, três
 * coisas ficam explícitas nesta tela, porque IA que lê dado de cliente não pode
 * ser uma caixa-preta: quem paga a conta, onde mora a chave e o que é enviado.
 */
export default function AiSettingsCard() {
  const { aiSettings, saveAiSettings, serviceName } = useApp();
  const [draft, setDraft] = useState<AiSettings>(aiSettings ?? FACTORY);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<LocalAiConfig | null>(null);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => setDraft(aiSettings ?? FACTORY), [aiSettings]);
  useEffect(() => setLocal(readLocalConfig()), []);

  const onServer = serviceName !== "localStorage";
  const set = (patch: Partial<AiSettings>) => setDraft((d) => ({ ...d, ...patch }));

  async function save(patch: Partial<AiSettings> = {}) {
    const next = { ...draft, ...patch };
    setSaving(true);
    try {
      await saveAiSettings(next);
      setDraft(next);
      toast.success("Assistente salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não consegui salvar.");
    } finally {
      setSaving(false);
    }
  }

  function saveKey() {
    const trimmed = key.trim();
    if (!trimmed) return toast.error("Cole a chave antes de salvar.");
    if (!trimmed.startsWith("sk-ant-")) {
      return toast.error("Isso não parece uma chave da Anthropic (elas começam com sk-ant-).");
    }
    const config: LocalAiConfig = { key: trimmed, model: draft.model, effort: draft.effort };
    writeLocalConfig(config);
    setLocal(config);
    setKey("");
    toast.success("Chave guardada neste navegador.");
  }

  function forgetKey() {
    writeLocalConfig(null);
    setLocal(null);
    toast.success("Chave apagada deste navegador.");
  }

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-sm font-bold">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Assistente de IA
          </h2>
          <p className="text-xs text-muted-foreground">
            Resume o dia, sugere pautas, escreve legenda e roteiro, lê a análise e explica o
            mês — olhando os dados que já estão aqui.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={draft.enabled}
            disabled={saving}
            aria-label="Assistente de IA ligado"
            onCheckedChange={(on) => void save({ enabled: on })}
          />
          {draft.enabled ? "Ligado" : "Desligado"}
        </label>
      </header>

      <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs">
        <strong>A IA nunca grava sozinha.</strong> Toda resposta é sugestão: ela só entra no
        sistema quando alguém clica em “aplicar”. E antes de cada pergunta a tela mostra, em
        texto, exatamente o que vai ser enviado — sem e-mail, telefone, documento nem chave.
      </p>

      {draft.enabled && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="ia-model" className="text-[11px]">
                Modelo
              </Label>
              <Input
                id="ia-model"
                value={draft.model}
                onChange={(e) => set({ model: e.target.value })}
                onBlur={() => void save()}
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ia-effort" className="text-[11px]">
                Capricho da resposta
              </Label>
              <Select
                value={draft.effort}
                onValueChange={(v) => void save({ effort: v as AiSettings["effort"] })}
              >
                <SelectTrigger id="ia-effort" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Rápido e barato</SelectItem>
                  <SelectItem value="medium">Equilibrado</SelectItem>
                  <SelectItem value="high">Caprichado (mais caro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ia-limit" className="text-[11px]">
                Teto de perguntas por dia
              </Label>
              <Input
                id="ia-limit"
                type="number"
                min={1}
                max={10000}
                value={draft.dailyLimit}
                onChange={(e) => set({ dailyLimit: Number(e.target.value) || 1 })}
                onBlur={() => void save()}
                className="h-9"
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              O que fica liberado
            </p>
            <p className="mb-1.5 text-[11px] text-muted-foreground">
              Nada marcado = tudo liberado.
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {AI_ACTIONS.map((a) => (
                <label key={a.id} className="flex items-start gap-2 text-xs">
                  <Checkbox
                    className="mt-0.5"
                    checked={draft.allowed.includes(a.id)}
                    aria-label={a.label}
                    onCheckedChange={(checked) =>
                      void save({
                        allowed: checked
                          ? [...draft.allowed, a.id]
                          : draft.allowed.filter((x) => x !== a.id),
                      })
                    }
                  />
                  <span>
                    {a.label}
                    <span className="block text-[11px] text-muted-foreground">{a.sends}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {onServer ? (
            <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs">
              <p className="font-medium">A chave fica no servidor</p>
              <p className="mt-1 text-muted-foreground">
                Publique a função e guarde a chave uma vez só. Este navegador nunca vê a chave,
                o teto acima vale para todo mundo e cada chamada fica registrada.
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-[11px]">
{`supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy assistente`}
              </pre>
            </div>
          ) : (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
              <p className="font-medium">Sem servidor, a chave fica neste navegador</p>
              <p className="mt-1 text-muted-foreground">
                Serve para experimentar antes de publicar. Quem abrir este navegador consegue
                ler a chave, e o teto acima não vale — quem conta é a Anthropic. Use uma chave
                com limite de gasto e apague quando terminar o teste.
              </p>
              {local ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-background px-2 py-1 font-mono text-[11px]">
                    {showKey ? local.key : `sk-ant-…${local.key.slice(-4)}`}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[11px]"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {showKey ? "esconder" : "mostrar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[11px] text-destructive"
                    onClick={forgetKey}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> apagar
                  </Button>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1 space-y-1">
                    <Label htmlFor="ia-key" className="text-[11px]">
                      Chave da Anthropic
                    </Label>
                    <Input
                      id="ia-key"
                      type="password"
                      value={key}
                      placeholder="sk-ant-..."
                      onChange={(e) => setKey(e.target.value)}
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                  <Button size="sm" onClick={saveKey}>
                    Guardar aqui
                  </Button>
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                A chave sai em{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  console.anthropic.com
                </a>
                , em Settings → API keys.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
