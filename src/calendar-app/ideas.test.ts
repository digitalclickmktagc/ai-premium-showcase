import { describe, expect, it } from "vitest";
import {
  buildIdea,
  canSetStatus,
  countByStatus,
  filterIdeas,
  forgetPost,
  ideaTitle,
  markUsed,
  parseIdea,
  retagIdea,
  setStatus,
  tagCloud,
  toggleVote,
} from "./ideas";
import type { Idea } from "./types";

const ME = "ana@agencia.com";
const ME_ID = { id: ME, handle: "ana" };
const OTHER = "bruno@agencia.com";

function idea(over: Partial<Idea> = {}): Idea {
  const base = buildIdea("Ideia qualquer", ME, { kind: "geral" }, "2026-03-01T10:00:00.000Z", "i1")!;
  return { ...base, ...over };
}

describe("parseIdea", () => {
  it("reads tags, mentions and the format out of one line", () => {
    const p = parseIdea("  Série   de bastidores da torra #reels #cafe @bruno ");
    expect(p.text).toBe("Série de bastidores da torra #reels #cafe @bruno");
    expect(p.tags).toEqual(["reels", "cafe"]);
    expect(p.mentions).toEqual(["bruno"]);
    expect(p.format).toBe("reels");
    expect(p.clean).toBe("Série de bastidores da torra");
  });

  it("normalises the format and keeps the tag that named it", () => {
    expect(parseIdea("teste #Stories").format).toBe("story");
    expect(parseIdea("teste #Stories").tags).toEqual(["stories"]);
    expect(parseIdea("teste #carousel").format).toBe("carrossel");
  });

  it("leaves format undefined when no tag names one", () => {
    expect(parseIdea("promo de inverno #promo").format).toBeUndefined();
  });

  it("accepts accents and numbers in tags, and does not repeat them", () => {
    const p = parseIdea("#promoção #promoção #black2026 texto");
    expect(p.tags).toEqual(["promoção", "black2026"]);
  });

  it("keeps an e-mail from being read as a mention of a person", () => {
    // Deliberate: "@" inside a word is not a mention, only a token that starts one.
    const p = parseIdea("falar com contato@cliente.com sobre o reels");
    expect(p.mentions).toEqual([]);
  });
});

describe("buildIdea", () => {
  it("refuses an empty line", () => {
    expect(buildIdea("   ", ME, { kind: "geral" })).toBeNull();
  });

  it("starts as nova, with no votes and no card", () => {
    const i = buildIdea("Enquete de sabores #story", ME, { kind: "cliente", clientId: "c1" })!;
    expect(i.status).toBe("nova");
    expect(i.votes).toEqual([]);
    expect(i.usedBy).toEqual([]);
    expect(i.format).toBe("story");
    expect(i.scope).toEqual({ kind: "cliente", clientId: "c1" });
  });
});

describe("ideaTitle", () => {
  it("drops the markers", () => {
    expect(ideaTitle({ text: "Bastidores da torra #reels @ana" })).toBe("Bastidores da torra");
  });

  it("cuts a long idea on a word boundary", () => {
    const long = "palavra ".repeat(20).trim();
    const title = ideaTitle({ text: long }, 50);
    expect(title.length).toBeLessThanOrEqual(51);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toContain("palavr…");
  });

  it("falls back to the raw text when the line is only markers", () => {
    expect(ideaTitle({ text: "#reels" })).toBe("#reels");
  });
});

describe("votes", () => {
  it("counts one vote per person and takes it back on a second click", () => {
    let i = idea();
    i = toggleVote(i, ME);
    i = toggleVote(i, OTHER);
    expect(i.votes).toEqual([ME, OTHER]);
    i = toggleVote(i, ME);
    expect(i.votes).toEqual([OTHER]);
  });
});

describe("status", () => {
  it("walks nova → na pauta → usada", () => {
    expect(canSetStatus("nova", "na_pauta")).toBe(true);
    expect(canSetStatus("na_pauta", "usada")).toBe(true);
  });

  it("lets anything be archived and an archived idea come back as nova", () => {
    expect(canSetStatus("usada", "arquivada")).toBe(true);
    expect(canSetStatus("arquivada", "nova")).toBe(true);
    expect(canSetStatus("arquivada", "usada")).toBe(false);
  });

  it("ignores a move that is not allowed", () => {
    const i = idea({ status: "arquivada" });
    expect(setStatus(i, "usada")).toBe(i);
  });
});

describe("link between an idea and the cards it produced", () => {
  it("records the card and marks the idea used", () => {
    const i = markUsed(idea(), { id: "p1", calendarId: "cal1" }, "2026-03-02T10:00:00.000Z");
    expect(i.status).toBe("usada");
    expect(i.usedBy).toEqual([{ postId: "p1", calendarId: "cal1", at: "2026-03-02T10:00:00.000Z" }]);
  });

  it("holds more than one card for the same idea", () => {
    let i = markUsed(idea(), { id: "p1", calendarId: "cal1" });
    i = markUsed(i, { id: "p2", calendarId: "cal2" });
    expect(i.usedBy.map((u) => u.postId)).toEqual(["p1", "p2"]);
  });

  it("does not record the same card twice", () => {
    const once = markUsed(idea(), { id: "p1", calendarId: "cal1" });
    expect(markUsed(once, { id: "p1", calendarId: "cal1" })).toBe(once);
  });

  it("puts the idea back on the pauta when its last card is deleted", () => {
    const used = markUsed(idea(), { id: "p1", calendarId: "cal1" });
    const after = forgetPost(used, "p1");
    expect(after.usedBy).toEqual([]);
    expect(after.status).toBe("na_pauta");
  });

  it("keeps the idea used while another card still points at it", () => {
    let i = markUsed(idea(), { id: "p1", calendarId: "cal1" });
    i = markUsed(i, { id: "p2", calendarId: "cal1" });
    const after = forgetPost(i, "p1");
    expect(after.status).toBe("usada");
    expect(after.usedBy).toHaveLength(1);
  });

  it("leaves an idea alone when the deleted card was never its own", () => {
    const i = idea();
    expect(forgetPost(i, "p9")).toBe(i);
  });
});

describe("retagIdea", () => {
  it("re-reads the markers after an edit", () => {
    const i = retagIdea(idea({ tags: ["antigo"], format: "reels" }), "novo texto #carrossel @ana");
    expect(i.tags).toEqual(["carrossel"]);
    expect(i.mentions).toEqual(["ana"]);
    expect(i.format).toBe("carrossel");
  });
});

describe("filterIdeas", () => {
  const list: Idea[] = [
    idea({ id: "a", text: "Receita de inverno #cafe", tags: ["cafe"], votes: [ME, OTHER], createdAt: "2026-03-01T10:00:00.000Z" }),
    idea({ id: "b", text: "Bastidores @ana", mentions: ["ana"], createdBy: OTHER, status: "na_pauta", votes: [OTHER], createdAt: "2026-03-05T10:00:00.000Z" }),
    idea({ id: "c", text: "Promo do cliente", scope: { kind: "cliente", clientId: "c1" }, status: "usada", createdAt: "2026-03-10T10:00:00.000Z" }),
    idea({ id: "d", text: "Ideia arquivada", status: "arquivada", createdAt: "2026-03-12T10:00:00.000Z" }),
  ];

  it("ranks by votes, then by how recent the idea is", () => {
    expect(filterIdeas(list, {}, ME_ID).map((i) => i.id)).toEqual(["a", "b", "d", "c"]);
  });

  it("filters by scope", () => {
    expect(filterIdeas(list, { scope: "geral" }, ME_ID).map((i) => i.id)).toEqual(["a", "b", "d"]);
    expect(filterIdeas(list, { scope: "c1" }, ME_ID).map((i) => i.id)).toEqual(["c"]);
    expect(filterIdeas(list, { scope: "c2" }, ME_ID)).toEqual([]);
  });

  it("filters by status, text and tag", () => {
    expect(filterIdeas(list, { status: "na_pauta" }, ME_ID).map((i) => i.id)).toEqual(["b"]);
    expect(filterIdeas(list, { text: "promo" }, ME_ID).map((i) => i.id)).toEqual(["c"]);
    expect(filterIdeas(list, { tag: "CAFE" }, ME_ID).map((i) => i.id)).toEqual(["a"]);
  });

  it("answers minhas, me marcaram e que votei", () => {
    expect(filterIdeas(list, { mine: true }, ME_ID).map((i) => i.id)).toEqual(["a", "d", "c"]);
    expect(filterIdeas(list, { mentioningMe: true }, ME_ID).map((i) => i.id)).toEqual(["b"]);
    expect(filterIdeas(list, { votedByMe: true }, ME_ID).map((i) => i.id)).toEqual(["a"]);
  });

  it("filters by date, taking both ends", () => {
    const got = filterIdeas(list, { from: "2026-03-05", to: "2026-03-10" }, ME_ID).map((i) => i.id);
    expect(got).toEqual(["b", "c"]);
  });
});

describe("tagCloud and counts", () => {
  it("counts each tag once per idea, most used first", () => {
    const list = [
      idea({ id: "a", tags: ["cafe", "promo"] }),
      idea({ id: "b", tags: ["cafe"] }),
    ];
    expect(tagCloud(list)).toEqual([
      { tag: "cafe", count: 2 },
      { tag: "promo", count: 1 },
    ]);
  });

  it("counts the chips", () => {
    const list = [idea({ status: "nova" }), idea({ status: "usada" }), idea({ status: "usada" })];
    expect(countByStatus(list)).toEqual({ all: 3, nova: 1, na_pauta: 0, usada: 2, arquivada: 0 });
  });
});
