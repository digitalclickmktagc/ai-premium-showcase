/**
 * Utilitários de conteúdo (benchmark ficha 17, item F17e).
 *
 * Small, boring calculations an agency does ten times a day and gets wrong
 * once a week: does this caption fit, how long will this script take to
 * read out loud, what is the engagement rate, what does this UTM look like.
 *
 * Every number here shows its formula on screen. Where the benchmark leaves
 * a band undocumented — "baixa / boa / excelente" engagement — this file
 * states the reference it uses and lets the agency change it, instead of
 * inventing a verdict and hiding where it came from.
 */

// ── Limites por rede ─────────────────────────────────────────

export interface NetworkLimit {
  id: string;
  label: string;
  /** Characters the network accepts in the caption/post body. */
  caption: number;
  /** Hashtags the network accepts, when it caps them. */
  hashtags?: number;
  note?: string;
}

export const NETWORK_LIMITS: NetworkLimit[] = [
  { id: "instagram", label: "Instagram (legenda)", caption: 2200, hashtags: 30 },
  { id: "instagram_bio", label: "Instagram (bio)", caption: 150 },
  { id: "facebook", label: "Facebook (post)", caption: 63206 },
  { id: "x", label: "X / Twitter", caption: 280 },
  { id: "linkedin", label: "LinkedIn (post)", caption: 3000 },
  { id: "tiktok", label: "TikTok (legenda)", caption: 2200 },
  { id: "youtube_title", label: "YouTube (título)", caption: 100 },
  { id: "youtube_desc", label: "YouTube (descrição)", caption: 5000 },
  {
    id: "whatsapp_status",
    label: "WhatsApp (status)",
    caption: 700,
    note: "Acima disso o texto é cortado com “ver mais”.",
  },
];

export interface TextCount {
  characters: number;
  /** What the network counts: emoji and accents as one character each. */
  words: number;
  lines: number;
  hashtags: string[];
  mentions: string[];
  /** Characters still available, negative when over. */
  remaining: number;
  overLimit: boolean;
  hashtagsOverLimit: boolean;
}

const TAG_RE = /(?<![\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;
const MENTION_RE = /(?<![\p{L}\p{N}_])@([\p{L}\p{N}._]+)/gu;

/** Counts a caption the way a network does: by visible characters. */
export function countText(text: string, limit: NetworkLimit): TextCount {
  // [...text] counts an emoji as one character, which is what the editor
  // shows the person — `text.length` would count it as two.
  const characters = [...text].length;
  const hashtags = [...text.matchAll(TAG_RE)].map((m) => m[1]);
  return {
    characters,
    words: text.trim() ? text.trim().split(/\s+/).length : 0,
    lines: text ? text.split(/\r?\n/).length : 0,
    hashtags,
    mentions: [...text.matchAll(MENTION_RE)].map((m) => m[1]),
    remaining: limit.caption - characters,
    overLimit: characters > limit.caption,
    hashtagsOverLimit: !!limit.hashtags && hashtags.length > limit.hashtags,
  };
}

// ── Tempo de fala ────────────────────────────────────────────

export type Pace = "lento" | "medio" | "rapido";

/** Words a minute. The three paces the ficha asks for, named out loud. */
export const PACE_WPM: Record<Pace, number> = { lento: 110, medio: 140, rapido: 170 };

export const PACE_LABEL: Record<Pace, string> = {
  lento: "Pausado (110 palavras/min)",
  medio: "Natural (140 palavras/min)",
  rapido: "Acelerado (170 palavras/min)",
};

/** How long a script takes to read out loud, in seconds. */
export function speakingSeconds(text: string, pace: Pace = "medio"): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.round((words / PACE_WPM[pace]) * 60);
}

export function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}min${seconds > 0 ? ` ${String(seconds).padStart(2, "0")}s` : ""}`;
}

// ── Taxa de engajamento ──────────────────────────────────────

export interface EngagementInput {
  likes: number;
  comments: number;
  shares?: number;
  saves?: number;
  /** Followers, or reach when the agency prefers reach as the base. */
  base: number;
}

export interface EngagementBand {
  /** Minimum rate, in percent, for this verdict. */
  min: number;
  label: string;
}

/**
 * Reference bands. The ficha documents that bands exist but not which ones,
 * so these are the common market reference for Instagram over followers —
 * and the screen says exactly that, instead of pretending the number is a
 * law of nature. The agency can change them.
 */
export const DEFAULT_BANDS: EngagementBand[] = [
  { min: 6, label: "Excelente" },
  { min: 3, label: "Boa" },
  { min: 1, label: "Mediana" },
  { min: 0, label: "Baixa" },
];

export interface Engagement {
  /** Percent, rounded to two decimals; null when there is no base. */
  rate: number | null;
  interactions: number;
  band: string | null;
  formula: string;
}

export function engagementRate(
  input: EngagementInput,
  bands: EngagementBand[] = DEFAULT_BANDS,
): Engagement {
  const interactions =
    input.likes + input.comments + (input.shares ?? 0) + (input.saves ?? 0);
  if (input.base <= 0) {
    return {
      rate: null,
      interactions,
      band: null,
      formula: "Sem base de seguidores ou alcance, não há taxa — e inventar uma não ajuda.",
    };
  }
  const rate = Math.round((interactions / input.base) * 10000) / 100;
  const band = [...bands].sort((a, b) => b.min - a.min).find((b) => rate >= b.min)?.label ?? null;
  return {
    rate,
    interactions,
    band,
    formula: `(${input.likes} curtidas + ${input.comments} comentários${
      input.shares ? ` + ${input.shares} compart.` : ""
    }${input.saves ? ` + ${input.saves} salvos` : ""}) ÷ ${input.base} × 100`,
  };
}

// ── UTM ──────────────────────────────────────────────────────

export interface UtmInput {
  url: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

/** Lowercase, no accents, spaces as hyphens: the only way tags stay comparable. */
export function slugifyTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildUtm(input: UtmInput): { url: string } | { error: string } {
  const raw = input.url.trim();
  if (!raw) return { error: "Informe o endereço de destino." };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { error: "Endereço inválido." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { error: "Use um endereço http ou https." };
  if (!input.source.trim() || !input.medium.trim() || !input.campaign.trim())
    return { error: "Origem, mídia e campanha são obrigatórias." };

  const params: [string, string | undefined][] = [
    ["utm_source", slugifyTag(input.source)],
    ["utm_medium", slugifyTag(input.medium)],
    ["utm_campaign", slugifyTag(input.campaign)],
    ["utm_content", input.content ? slugifyTag(input.content) : undefined],
    ["utm_term", input.term ? slugifyTag(input.term) : undefined],
  ];
  for (const [key, value] of params) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  return { url: url.toString() };
}

// ── Link de WhatsApp ─────────────────────────────────────────

/**
 * Builds a wa.me link. A number written with "+" is taken as it is; without
 * one, the country code is added, because that is how people here type a
 * phone number. Guessing by length cannot work — a US number and a mobile
 * with DDD both have eleven digits.
 */
export function whatsappLink(
  phone: string,
  message = "",
  defaultCountry = "55",
): { url: string } | { error: string } {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return { error: "Telefone incompleto." };
  const explicitCountry = phone.trim().startsWith("+");
  const full = explicitCountry || digits.startsWith(defaultCountry) && digits.length > 11
    ? digits
    : `${defaultCountry}${digits}`;
  const text = message.trim() ? `?text=${encodeURIComponent(message.trim())}` : "";
  return { url: `https://wa.me/${full}${text}` };
}

// ── Formatação de legenda ────────────────────────────────────

export interface CaptionFormat {
  text: string;
  /** What changed, so the person can see it was not magic. */
  changes: string[];
}

/**
 * Tidies a caption: trailing spaces gone, no more than one blank line in a
 * row, and the hashtags gathered at the end in the order they appeared.
 * Nothing is rewritten — the agency's words stay the agency's words.
 */
export function formatCaption(text: string, moveHashtags = true): CaptionFormat {
  const changes: string[] = [];
  let lines = text.split(/\r?\n/).map((l) => l.replace(/[ \t]+$/g, ""));
  if (lines.some((l, i) => l !== text.split(/\r?\n/)[i])) changes.push("espaços no fim das linhas");

  const before = lines.length;
  lines = lines.filter((line, i) => !(line.trim() === "" && lines[i - 1]?.trim() === ""));
  if (lines.length !== before) changes.push("linhas em branco repetidas");

  let body = lines.join("\n").trim();

  if (moveHashtags) {
    const tags = [...body.matchAll(TAG_RE)].map((m) => m[0]);
    if (tags.length > 0) {
      const stripped = body.replace(TAG_RE, "").replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").trim();
      const unique = [...new Set(tags)];
      if (unique.length !== tags.length) changes.push("etiquetas repetidas");
      body = `${stripped}\n\n${unique.join(" ")}`;
      changes.push("etiquetas agrupadas no fim");
    }
  }

  return { text: body, changes };
}

// ── Tamanhos por rede ────────────────────────────────────────

export interface SizeSpec {
  network: string;
  format: string;
  size: string;
  ratio: string;
}

/** Reference sizes. Kept as data so a change is an edit, not a deploy. */
export const SIZES: SizeSpec[] = [
  { network: "Instagram", format: "Feed quadrado", size: "1080 × 1080", ratio: "1:1" },
  { network: "Instagram", format: "Feed retrato", size: "1080 × 1350", ratio: "4:5" },
  { network: "Instagram", format: "Stories / Reels", size: "1080 × 1920", ratio: "9:16" },
  { network: "Instagram", format: "Capa do Reels no feed", size: "1080 × 1350", ratio: "4:5" },
  { network: "Facebook", format: "Feed", size: "1200 × 1500", ratio: "4:5" },
  { network: "Facebook", format: "Capa", size: "1640 × 856", ratio: "1,91:1" },
  { network: "LinkedIn", format: "Feed", size: "1200 × 1200", ratio: "1:1" },
  { network: "LinkedIn", format: "Capa da empresa", size: "1128 × 191", ratio: "5,9:1" },
  { network: "TikTok", format: "Vídeo", size: "1080 × 1920", ratio: "9:16" },
  { network: "YouTube", format: "Miniatura", size: "1280 × 720", ratio: "16:9" },
  { network: "YouTube", format: "Shorts", size: "1080 × 1920", ratio: "9:16" },
];
