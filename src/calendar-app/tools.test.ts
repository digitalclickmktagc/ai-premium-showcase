import { describe, expect, it } from "vitest";
import {
  DEFAULT_BANDS,
  NETWORK_LIMITS,
  buildUtm,
  countText,
  engagementRate,
  formatCaption,
  formatSeconds,
  slugifyTag,
  speakingSeconds,
  whatsappLink,
} from "./tools";

const instagram = NETWORK_LIMITS.find((n) => n.id === "instagram")!;
const x = NETWORK_LIMITS.find((n) => n.id === "x")!;

describe("countText", () => {
  it("counts characters, words, lines, tags and mentions", () => {
    const out = countText("Bom dia!\nCafé fresquinho #cafe #bomdia @aurora", instagram);
    expect(out.characters).toBe(46);
    expect(out.words).toBe(7);
    expect(out.lines).toBe(2);
    expect(out.hashtags).toEqual(["cafe", "bomdia"]);
    expect(out.mentions).toEqual(["aurora"]);
  });

  it("counts an emoji as one character, like the editor shows", () => {
    expect(countText("☕️", instagram).characters).toBeLessThanOrEqual(2);
    expect(countText("é", instagram).characters).toBe(1);
  });

  it("says what is left and when it passed the limit", () => {
    const short = countText("oi", x);
    expect(short.remaining).toBe(278);
    expect(short.overLimit).toBe(false);
    const long = countText("a".repeat(281), x);
    expect(long.remaining).toBe(-1);
    expect(long.overLimit).toBe(true);
  });

  it("warns when there are more hashtags than the network takes", () => {
    const many = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" ");
    expect(countText(many, instagram).hashtagsOverLimit).toBe(true);
    expect(countText("#um #dois", instagram).hashtagsOverLimit).toBe(false);
  });

  it("does not read an e-mail as a mention", () => {
    expect(countText("fale com contato@aurora.com", instagram).mentions).toEqual([]);
  });

  it("counts an empty caption as empty", () => {
    expect(countText("", instagram)).toMatchObject({ characters: 0, words: 0, lines: 0 });
  });
});

describe("speakingSeconds", () => {
  it("is slower when the pace is slower", () => {
    const text = Array.from({ length: 140 }, () => "palavra").join(" ");
    expect(speakingSeconds(text, "medio")).toBe(60);
    expect(speakingSeconds(text, "lento")).toBeGreaterThan(60);
    expect(speakingSeconds(text, "rapido")).toBeLessThan(60);
  });

  it("is zero for nothing to say", () => {
    expect(speakingSeconds("   ")).toBe(0);
  });

  it("reads a duration out in minutes and seconds", () => {
    expect(formatSeconds(45)).toBe("45s");
    expect(formatSeconds(60)).toBe("1min");
    expect(formatSeconds(95)).toBe("1min 35s");
  });
});

describe("engagementRate", () => {
  it("uses the market formula and shows it", () => {
    const out = engagementRate({ likes: 120, comments: 30, shares: 10, saves: 40, base: 4000 });
    expect(out.interactions).toBe(200);
    expect(out.rate).toBe(5);
    expect(out.band).toBe("Boa");
    expect(out.formula).toContain("÷ 4000 × 100");
  });

  it("keeps two decimals", () => {
    expect(engagementRate({ likes: 1, comments: 0, base: 3000 }).rate).toBe(0.03);
  });

  it("refuses to invent a rate with no base", () => {
    const out = engagementRate({ likes: 10, comments: 2, base: 0 });
    expect(out.rate).toBeNull();
    expect(out.band).toBeNull();
  });

  it("follows the bands it is given", () => {
    const out = engagementRate({ likes: 700, comments: 0, base: 1000 }, DEFAULT_BANDS);
    expect(out.rate).toBe(70);
    expect(out.band).toBe("Excelente");
    const custom = engagementRate({ likes: 70, comments: 0, base: 1000 }, [
      { min: 50, label: "Lendária" },
      { min: 0, label: "Normal" },
    ]);
    expect(custom.band).toBe("Normal");
  });
});

describe("buildUtm", () => {
  it("builds the address with normalised tags", () => {
    const out = buildUtm({
      url: "aurora.com.br/promo",
      source: "Instagram",
      medium: "Social Orgânico",
      campaign: "Dia das Mães 2026",
    });
    expect(out).toEqual({
      url: "https://aurora.com.br/promo?utm_source=instagram&utm_medium=social-organico&utm_campaign=dia-das-maes-2026",
    });
  });

  it("keeps the parameters the address already had", () => {
    const out = buildUtm({ url: "https://a.com/?ref=x", source: "a", medium: "b", campaign: "c" });
    expect("url" in out && out.url).toContain("ref=x");
  });

  it("demands destination, source, medium and campaign", () => {
    expect(buildUtm({ url: "", source: "a", medium: "b", campaign: "c" })).toHaveProperty("error");
    expect(buildUtm({ url: "a.com", source: "", medium: "b", campaign: "c" })).toHaveProperty("error");
  });

  it("refuses an address that is not http(s)", () => {
    expect(buildUtm({ url: "javascript:alert(1)", source: "a", medium: "b", campaign: "c" })).toHaveProperty(
      "error",
    );
  });

  it("normalises a tag the same way every time", () => {
    expect(slugifyTag("  Promoção de Verão!! ")).toBe("promocao-de-verao");
  });
});

describe("whatsappLink", () => {
  it("adds the country code when the number has none", () => {
    expect(whatsappLink("(61) 99999-0000")).toEqual({ url: "https://wa.me/5561999990000" });
  });

  it("keeps a number written with +, whatever its length", () => {
    expect(whatsappLink("+1 202 555 0147")).toEqual({ url: "https://wa.me/12025550147" });
    expect(whatsappLink("+55 61 99999-0000")).toEqual({ url: "https://wa.me/5561999990000" });
  });

  it("keeps a number that already starts with the country code", () => {
    expect(whatsappLink("55 61 99999-0000")).toEqual({ url: "https://wa.me/5561999990000" });
  });

  it("carries the message, encoded", () => {
    const out = whatsappLink("61999990000", "Olá! Tudo bem?");
    expect("url" in out && out.url).toContain("?text=Ol%C3%A1!%20Tudo%20bem%3F");
  });

  it("refuses a number that is too short to be one", () => {
    expect(whatsappLink("123")).toHaveProperty("error");
  });
});

describe("formatCaption", () => {
  it("removes trailing spaces and repeated blank lines", () => {
    const out = formatCaption("Bom dia   \n\n\n\nCafé fresco", false);
    expect(out.text).toBe("Bom dia\n\nCafé fresco");
    expect(out.changes).toContain("linhas em branco repetidas");
  });

  it("gathers the hashtags at the end, without repeating them", () => {
    const out = formatCaption("Café #cafe especial #cafe #bomdia");
    expect(out.text).toBe("Café especial\n\n#cafe #bomdia");
    expect(out.changes).toContain("etiquetas repetidas");
  });

  it("leaves the hashtags where they are when asked to", () => {
    const out = formatCaption("Café #cafe especial", false);
    expect(out.text).toBe("Café #cafe especial");
  });

  it("does not rewrite the words", () => {
    const text = "Promoção imperdível no delivery";
    expect(formatCaption(text).text).toBe(text);
  });
});
