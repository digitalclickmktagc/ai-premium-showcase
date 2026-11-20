import { useMemo, useState } from "react";
import {
  Copy,
  Grid3x3,
  Link as LinkIcon,
  MessageCircle,
  Ruler,
  Timer,
  Type,
  TrendingUp,
  Wand2,
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
import {
  DEFAULT_BANDS,
  NETWORK_LIMITS,
  PACE_LABEL,
  SIZES,
  buildUtm,
  countText,
  engagementRate,
  formatCaption,
  formatSeconds,
  speakingSeconds,
  whatsappLink,
  type Pace,
} from "../tools";
import { safeExternalUrl } from "../utils";

/**
 * Utilitários de conteúdo (benchmark ficha 17, F17e).
 *
 * Nothing here is stored and nothing leaves the browser — the image grid
 * included, which is why it takes links and never uploads a file.
 */
export default function ToolsPage() {
  return (
    <AdminLayout section="ferramentas" title="Ferramentas">
      <header className="mb-4">
        <h1 className="font-display text-xl font-bold sm:text-2xl">Ferramentas</h1>
        <p className="text-xs text-muted-foreground">
          Contas pequenas que a agência faz dez vezes por dia. Nada aqui é salvo, e nada sai do
          seu navegador.
        </p>
      </header>

      <Tabs defaultValue="texto">
        <TabsList>
          <TabsTrigger value="texto" className="gap-1.5">
            <Type className="h-3.5 w-3.5" /> Legenda
          </TabsTrigger>
          <TabsTrigger value="fala" className="gap-1.5">
            <Timer className="h-3.5 w-3.5" /> Tempo de fala
          </TabsTrigger>
          <TabsTrigger value="engajamento" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Engajamento
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-1.5">
            <LinkIcon className="h-3.5 w-3.5" /> Links
          </TabsTrigger>
          <TabsTrigger value="grade" className="gap-1.5">
            <Grid3x3 className="h-3.5 w-3.5" /> Grade
          </TabsTrigger>
          <TabsTrigger value="tamanhos" className="gap-1.5">
            <Ruler className="h-3.5 w-3.5" /> Tamanhos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="texto" className="mt-4">
          <CaptionTool />
        </TabsContent>
        <TabsContent value="fala" className="mt-4">
          <SpeechTool />
        </TabsContent>
        <TabsContent value="engajamento" className="mt-4">
          <EngagementTool />
        </TabsContent>
        <TabsContent value="links" className="mt-4 grid gap-3 lg:grid-cols-2">
          <UtmTool />
          <WhatsAppTool />
        </TabsContent>
        <TabsContent value="grade" className="mt-4">
          <GridTool />
        </TabsContent>
        <TabsContent value="tamanhos" className="mt-4">
          <SizesTool />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function copy(value: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success("Copiado."))
    .catch(() => toast.error("Não deu para copiar."));
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </section>
  );
}

function CaptionTool() {
  const [text, setText] = useState("");
  const [network, setNetwork] = useState(NETWORK_LIMITS[0].id);
  const limit = NETWORK_LIMITS.find((n) => n.id === network) ?? NETWORK_LIMITS[0];
  const count = countText(text, limit);
  const tidy = useMemo(() => formatCaption(text), [text]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Legenda">
        <div className="mb-2 flex items-center gap-2">
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger className="h-9 w-[220px]" aria-label="Rede">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NETWORK_LIMITS.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span
            className={cn(
              "text-sm tabular-nums",
              count.overLimit ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {count.characters}/{limit.caption}
          </span>
        </div>
        <Label htmlFor="cap-text" className="sr-only">
          Texto da legenda
        </Label>
        <Textarea
          id="cap-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cole a legenda aqui."
          className="min-h-48"
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          {count.words} palavra(s) · {count.lines} linha(s) · {count.hashtags.length} etiqueta(s) ·{" "}
          {count.mentions.length} menção(ões)
          {limit.note && ` · ${limit.note}`}
        </p>
        {count.overLimit && (
          <p className="text-[11px] text-destructive">
            Passou {Math.abs(count.remaining)} caractere(s) do limite.
          </p>
        )}
        {count.hashtagsOverLimit && (
          <p className="text-[11px] text-destructive">
            {limit.label} aceita no máximo {limit.hashtags} etiquetas.
          </p>
        )}
      </Panel>

      <Panel title="Arrumada">
        <Textarea
          readOnly
          value={tidy.text}
          aria-label="Legenda arrumada"
          className="min-h-48 bg-foreground/[0.02]"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(tidy.text)}>
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {tidy.changes.length === 0
              ? "Nada a arrumar."
              : `Mudou: ${tidy.changes.join(", ")}. As palavras continuam as suas.`}
          </span>
        </div>
      </Panel>
    </div>
  );
}

function SpeechTool() {
  const [text, setText] = useState("");
  const [pace, setPace] = useState<Pace>("medio");
  const seconds = speakingSeconds(text, pace);

  return (
    <Panel title="Tempo de fala">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Select value={pace} onValueChange={(v) => setPace(v as Pace)}>
          <SelectTrigger className="h-9 w-[240px]" aria-label="Ritmo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PACE_LABEL) as Pace[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PACE_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-lg font-semibold tabular-nums">{formatSeconds(seconds)}</span>
      </div>
      <Label htmlFor="speech-text" className="sr-only">
        Texto do roteiro
      </Label>
      <Textarea
        id="speech-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Cole o roteiro para saber quanto tempo ele leva falado."
        className="min-h-40"
      />
      <p className="mt-2 text-[11px] text-muted-foreground">
        Conta palavras ÷ palavras por minuto do ritmo escolhido. Serve para saber se cabe nos 60s
        do Reels; a leitura de verdade varia com pausas e respiração.
      </p>
    </Panel>
  );
}

function EngagementTool() {
  const [values, setValues] = useState({ likes: 0, comments: 0, shares: 0, saves: 0, base: 0 });
  const out = engagementRate(values);
  const field = (key: keyof typeof values, label: string) => (
    <div className="grid gap-1">
      <Label htmlFor={`eng-${key}`} className="text-[11px]">
        {label}
      </Label>
      <Input
        id={`eng-${key}`}
        type="number"
        min={0}
        value={values[key] || ""}
        onChange={(e) => setValues({ ...values, [key]: Number(e.target.value) || 0 })}
        className="h-9"
      />
    </div>
  );

  return (
    <Panel title="Taxa de engajamento">
      <div className="grid gap-2 sm:grid-cols-5">
        {field("likes", "Curtidas")}
        {field("comments", "Comentários")}
        {field("shares", "Compart.")}
        {field("saves", "Salvos")}
        {field("base", "Seguidores")}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">
        {out.rate === null ? "—" : `${out.rate}%`}{" "}
        {out.band && <span className="text-sm font-normal text-muted-foreground">{out.band}</span>}
      </p>
      <p className="text-[11px] text-muted-foreground">{out.formula}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        As faixas ({DEFAULT_BANDS.map((b) => `${b.label} ≥ ${b.min}%`).join(", ")}) são referência
        de mercado para Instagram sobre seguidores, não lei da natureza: comparar com o próprio
        histórico do cliente diz mais do que comparar com a média de alguém.
      </p>
    </Panel>
  );
}

function UtmTool() {
  const [form, setForm] = useState({
    url: "",
    source: "",
    medium: "",
    campaign: "",
    content: "",
    term: "",
  });
  const out = buildUtm(form);
  const field = (key: keyof typeof form, label: string, placeholder?: string) => (
    <div className="grid gap-1">
      <Label htmlFor={`utm-${key}`} className="text-[11px]">
        {label}
      </Label>
      <Input
        id={`utm-${key}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  );

  return (
    <Panel title="Gerador de UTM">
      <div className="grid gap-2">
        {field("url", "Destino", "aurora.com.br/promo")}
        <div className="grid gap-2 sm:grid-cols-3">
          {field("source", "Origem", "instagram")}
          {field("medium", "Mídia", "social")}
          {field("campaign", "Campanha", "dia-das-maes")}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {field("content", "Conteúdo (opcional)", "story-1")}
          {field("term", "Termo (opcional)")}
        </div>
      </div>
      {"error" in out ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{out.error}</p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <Input readOnly value={out.url} aria-label="Endereço com UTM" className="h-9 font-mono text-xs" />
          <Button size="sm" variant="outline" onClick={() => copy(out.url)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Tudo em minúsculas, sem acento e com hífen: é o que mantém as campanhas comparáveis no
        relatório — "Dia das Mães" e "dia-das-maes" viram duas campanhas diferentes.
      </p>
    </Panel>
  );
}

function WhatsAppTool() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const out = whatsappLink(phone, message);

  return (
    <Panel title="Link de WhatsApp">
      <div className="grid gap-2">
        <div className="grid gap-1">
          <Label htmlFor="wa-phone" className="text-[11px]">
            Telefone
          </Label>
          <Input
            id="wa-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(61) 99999-0000"
            className="h-9"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="wa-msg" className="text-[11px]">
            Mensagem pronta
          </Label>
          <Textarea
            id="wa-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Olá! Vim pelo Instagram e quero saber do plano mensal."
            className="min-h-20"
          />
        </div>
      </div>
      {"error" in out ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{out.error}</p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <Input readOnly value={out.url} aria-label="Link do WhatsApp" className="h-9 font-mono text-xs" />
          <Button size="sm" variant="outline" onClick={() => copy(out.url)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Sem o "+", o código do país (55) entra sozinho. Com "+", o número vai como está.
      </p>
    </Panel>
  );
}

function GridTool() {
  const [raw, setRaw] = useState("");
  const images = raw
    .split(/[\s,]+/)
    .map((u) => safeExternalUrl(u))
    .filter((u): u is string => !!u);

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr,320px]">
      <Panel title="Prévia da grade">
        <Label htmlFor="grid-urls" className="text-[11px]">
          Endereços das imagens, um por linha
        </Label>
        <Textarea
          id="grid-urls"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"https://.../1.jpg\nhttps://.../2.jpg"}
          className="mt-1 min-h-40 font-mono text-xs"
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Só endereços http(s) — nenhum arquivo é enviado para lugar nenhum. A grade mostra o
          feed como o cliente vê: três colunas, o mais novo primeiro.
        </p>
      </Panel>
      <Panel title={`Feed (${images.length})`}>
        {images.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Cole os endereços para ver a grade.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {images.map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={src}
                alt=""
                loading="lazy"
                className="aspect-square w-full bg-foreground/[0.04] object-cover"
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function SizesTool() {
  return (
    <Panel title="Tamanhos por rede">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-1.5 pr-3">Rede</th>
              <th className="py-1.5 pr-3">Formato</th>
              <th className="py-1.5 pr-3">Tamanho</th>
              <th className="py-1.5">Proporção</th>
            </tr>
          </thead>
          <tbody>
            {SIZES.map((s, i) => (
              <tr key={i} className="border-b border-border/60">
                <td className="py-1.5 pr-3">{s.network}</td>
                <td className="py-1.5 pr-3">{s.format}</td>
                <td className="py-1.5 pr-3 tabular-nums">{s.size}</td>
                <td className="py-1.5 tabular-nums">{s.ratio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Wand2 className="h-3 w-3" /> Referência de uso, não regra da plataforma: as redes mudam
        isso sem avisar.
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <MessageCircle className="h-3 w-3" /> Recorte de imagem não está aqui: cortar bem exige
        ver o resultado, e o editor que a equipe já usa faz isso melhor.
      </p>
    </Panel>
  );
}
