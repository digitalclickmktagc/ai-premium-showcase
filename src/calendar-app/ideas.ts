import type { Idea, IdeaStatus, Post } from "./types";

/**
 * Banco de ideias de pauta (benchmark ficha 08).
 *
 * The capture is one line of text: `#etiquetas`, `@menções` and the format
 * are read out of what the person typed, so nothing has to be filled in a
 * form before an idea can be written down.
 *
 * The ficha's own critique is the part worth fixing: in the system it
 * describes, an idea that became a card leaves no trace of where it went.
 * Here the link is kept on both sides — the idea records the posts it
 * produced, and each post records the idea it came from.
 */

/** Formats a `#tag` can name. Anything else stays an ordinary tag. */
const FORMATS: Record<string, string> = {
  feed: "feed",
  post: "feed",
  carrossel: "carrossel",
  carousel: "carrossel",
  reels: "reels",
  reel: "reels",
  video: "reels",
  stories: "story",
  story: "story",
  live: "live",
};

export interface ParsedIdea {
  /** The text as typed, trimmed. */
  text: string;
  /** Lowercased, de-duplicated, in the order they were typed. */
  tags: string[];
  mentions: string[];
  /** Normalised content format, when one of the tags named one. */
  format?: string;
  /** The text without the `#` and `@` markers, for a card title. */
  clean: string;
}

// The marker only counts at the start of a word, so `contato@cliente.com`
// is an e-mail address in the text and not a mention of "cliente.com".
const TAG_RE = /(?<![\p{L}\p{N}_])#([\p{L}\p{N}_-]+)/gu;
const MENTION_RE = /(?<![\p{L}\p{N}_])@([\p{L}\p{N}._-]+)/gu;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Reads tags, mentions and format out of a single line of text. */
export function parseIdea(raw: string): ParsedIdea {
  const text = raw.trim().replace(/\s+/g, " ");
  const tags = unique([...text.matchAll(TAG_RE)].map((m) => m[1].toLowerCase()));
  const mentions = unique([...text.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase()));
  const format = tags.map((t) => FORMATS[t]).find(Boolean);
  const clean = text
    .replace(TAG_RE, "")
    .replace(MENTION_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  return { text, tags, mentions, format, clean };
}

/** A short title for the card an idea becomes. */
export function ideaTitle(idea: Pick<Idea, "text">, limit = 80): string {
  const { clean, text } = parseIdea(idea.text);
  const base = clean || text;
  if (base.length <= limit) return base;
  const cut = base.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Builds an idea from a line of text. `by` identifies whoever typed it. */
export function buildIdea(
  raw: string,
  by: string,
  scope: Idea["scope"],
  now = new Date().toISOString(),
  id: string = crypto.randomUUID(),
): Idea | null {
  const parsed = parseIdea(raw);
  if (!parsed.text) return null;
  return {
    id,
    text: parsed.text,
    scope,
    tags: parsed.tags,
    mentions: parsed.mentions,
    format: parsed.format,
    status: "nova",
    votes: [],
    usedBy: [],
    createdBy: by,
    createdAt: now,
    updatedAt: now,
  };
}

/** Re-reads tags, mentions and format after the text was edited. */
export function retagIdea(idea: Idea, raw: string, now = new Date().toISOString()): Idea {
  const parsed = parseIdea(raw);
  return {
    ...idea,
    text: parsed.text,
    tags: parsed.tags,
    mentions: parsed.mentions,
    format: parsed.format,
    updatedAt: now,
  };
}

/** One vote per person: voting again takes the vote back. */
export function toggleVote(idea: Idea, by: string, now = new Date().toISOString()): Idea {
  const votes = idea.votes.includes(by)
    ? idea.votes.filter((v) => v !== by)
    : [...idea.votes, by];
  return { ...idea, votes, updatedAt: now };
}

const TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  nova: ["na_pauta", "usada", "arquivada"],
  na_pauta: ["usada", "nova", "arquivada"],
  usada: ["arquivada", "na_pauta"],
  arquivada: ["nova"],
};

export function canSetStatus(from: IdeaStatus, to: IdeaStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function setStatus(
  idea: Idea,
  status: IdeaStatus,
  now = new Date().toISOString(),
): Idea {
  if (!canSetStatus(idea.status, status)) return idea;
  return { ...idea, status, updatedAt: now };
}

/**
 * Records that an idea produced a card. The same idea can feed more than one
 * card (the ficha's edge case), so the link is a list, and re-recording the
 * same card changes nothing.
 */
export function markUsed(
  idea: Idea,
  post: Pick<Post, "id" | "calendarId">,
  now = new Date().toISOString(),
): Idea {
  if (idea.usedBy.some((u) => u.postId === post.id)) return idea;
  return {
    ...idea,
    status: "usada",
    usedBy: [...idea.usedBy, { postId: post.id, calendarId: post.calendarId, at: now }],
    updatedAt: now,
  };
}

/** Drops a card's link when the card itself is gone. */
export function forgetPost(idea: Idea, postId: string, now = new Date().toISOString()): Idea {
  if (!idea.usedBy.some((u) => u.postId === postId)) return idea;
  const usedBy = idea.usedBy.filter((u) => u.postId !== postId);
  return {
    ...idea,
    usedBy,
    // An idea whose only card was deleted goes back to the pauta, not to
    // "usada": otherwise it silently disappears from everyone's list.
    status: usedBy.length === 0 && idea.status === "usada" ? "na_pauta" : idea.status,
    updatedAt: now,
  };
}

export interface IdeaFilter {
  /** `all`, `geral`, or a client id. */
  scope?: string;
  status?: IdeaStatus | "all";
  /** Free text, matched against the idea's text. */
  text?: string;
  tag?: string;
  /** Only ideas written by `me`. */
  mine?: boolean;
  /** Only ideas that mention `me`. */
  mentioningMe?: boolean;
  /** Only ideas `me` voted for. */
  votedByMe?: boolean;
  from?: string;
  to?: string;
}

function matchesScope(idea: Idea, scope: string | undefined): boolean {
  if (!scope || scope === "all") return true;
  if (scope === "geral") return idea.scope.kind === "geral";
  return idea.scope.kind === "cliente" && idea.scope.clientId === scope;
}

/**
 * Who "eu" is, for the three personal filters. The id is what authorship and
 * votes are recorded under; the handle is what an `@menção` writes. They are
 * two different things — nobody types their own e-mail address after an "@".
 */
export interface IdeaIdentity {
  id: string;
  handle: string;
}

/**
 * Filters and ranks. The default order is the one that matters when the team
 * sits down to plan: most voted first, then the most recent.
 */
export function filterIdeas(ideas: Idea[], filter: IdeaFilter, me: IdeaIdentity): Idea[] {
  const needle = filter.text?.trim().toLowerCase();
  const tag = filter.tag?.toLowerCase();
  const mention = me.handle.toLowerCase();
  return ideas
    .filter((i) => {
      if (!matchesScope(i, filter.scope)) return false;
      if (filter.status && filter.status !== "all" && i.status !== filter.status) return false;
      if (needle && !i.text.toLowerCase().includes(needle)) return false;
      if (tag && !i.tags.includes(tag)) return false;
      if (filter.mine && i.createdBy !== me.id) return false;
      if (filter.mentioningMe && !i.mentions.includes(mention)) return false;
      if (filter.votedByMe && !i.votes.includes(me.id)) return false;
      const day = i.createdAt.slice(0, 10);
      if (filter.from && day < filter.from) return false;
      if (filter.to && day > filter.to) return false;
      return true;
    })
    .sort(
      (a, b) =>
        b.votes.length - a.votes.length || b.createdAt.localeCompare(a.createdAt),
    );
}

/** Every tag in use, most used first — what the filter offers. */
export function tagCloud(ideas: Idea[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const idea of ideas) {
    for (const tag of idea.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Counts for the status chips, computed over the same scope the list uses. */
export function countByStatus(ideas: Idea[]): Record<IdeaStatus | "all", number> {
  const base = { all: ideas.length, nova: 0, na_pauta: 0, usada: 0, arquivada: 0 };
  for (const idea of ideas) base[idea.status] += 1;
  return base;
}
