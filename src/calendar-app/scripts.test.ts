import { describe, expect, it } from "vitest";
import {
  MAX_SCENES,
  canAddScene,
  formatDuration,
  newScene,
  newScript,
  nextVersion,
  reviewScript,
  spokenWords,
  statusFromPost,
  toPlainText,
  totalSeconds,
  validateScript,
} from "./scripts";
import type { Post, Script, ScriptScene } from "./types";

const NOW = "2026-09-01T10:00:00.000Z";

function script(over: Partial<Script> = {}): Script {
  return { ...newScript("video", "p1", "Reels da torra", NOW, "r1"), ...over };
}

function scene(over: Partial<ScriptScene> = {}): ScriptScene {
  return { id: "c1", seconds: 5, ...over };
}

function post(over: Partial<Post> = {}): Post {
  return {
    id: "p1",
    calendarId: "cal1",
    title: "Card",
    date: "2026-09-10",
    status: "todo",
    description: "",
    rescheduleHistory: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe("newScript", () => {
  it("starts a video script with one scene and the usual columns", () => {
    const s = newScript("video", "p1", "  ", NOW, "r1");
    expect(s.title).toBe("Roteiro");
    expect(s.scenes).toHaveLength(1);
    expect(s.fields).toContain("seconds");
    expect(s.status).toBe("rascunho");
    expect(s.version).toBe(1);
  });

  it("starts a stories screen as a text screen", () => {
    expect(newScene("stories").screenKind).toBe("texto");
    expect(newScene("video").screenKind).toBeUndefined();
  });
});

describe("limits", () => {
  it("stops at 60 scenes for video and 40 screens for stories", () => {
    expect(MAX_SCENES).toEqual({ video: 60, stories: 40 });
    const full = script({ scenes: Array.from({ length: 60 }, (_, i) => scene({ id: `c${i}` })) });
    expect(canAddScene(full)).toBe(false);
    expect(validateScript({ ...full, scenes: [...full.scenes, scene({ id: "extra" })] })).toMatch(
      /até 60/,
    );
    const stories = script({
      kind: "stories",
      scenes: Array.from({ length: 41 }, (_, i) => scene({ id: `t${i}` })),
    });
    expect(validateScript(stories)).toMatch(/até 40 telas/);
  });

  it("refuses a negative or absurd duration", () => {
    expect(validateScript(script({ scenes: [scene({ seconds: -1 })] }))).toMatch(/negativa/);
    expect(validateScript(script({ scenes: [scene({ seconds: 601 })] }))).toMatch(/dez minutos/);
  });

  it("demands a name", () => {
    expect(validateScript(script({ title: "  " }))).toMatch(/nome/);
  });
});

describe("timing", () => {
  it("adds the scenes up and reads the total out", () => {
    const s = script({ scenes: [scene({ seconds: 12 }), scene({ id: "c2", seconds: 50 })] });
    expect(totalSeconds(s)).toBe(62);
    expect(formatDuration(62)).toBe("1min 02s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(120)).toBe("2min");
  });

  it("counts only the spoken lines", () => {
    const s = script({
      scenes: [
        scene({ speech: "Bom dia, tudo bem?", onScreen: "não conta isso aqui" }),
        scene({ id: "c2", speech: "   " }),
      ],
    });
    expect(spokenWords(s)).toBe(4);
  });
});

describe("reviewScript", () => {
  it("warns when the script is longer than the format takes", () => {
    const s = script({ scenes: [scene({ seconds: 90 })] });
    expect(reviewScript(s, 60)[0].message).toMatch(/1min 30s.*1min/);
    expect(reviewScript(s, 120)).toEqual([]);
  });

  it("warns about a line nobody can read in the time given", () => {
    const s = script({
      scenes: [scene({ seconds: 3, speech: "uma frase bem longa que ninguém lê em três segundos de jeito nenhum" })],
    });
    expect(reviewScript(s)[0].message).toMatch(/Fala longa/);
  });

  it("accepts a line that fits", () => {
    expect(reviewScript(script({ scenes: [scene({ seconds: 5, speech: "Bom dia a todos" })] }))).toEqual([]);
  });

  it("warns about a link screen with no address written", () => {
    const s = script({ kind: "stories", scenes: [scene({ screenKind: "link" })] });
    expect(reviewScript(s)[0].message).toMatch(/link sem o endereço/);
  });
});

describe("statusFromPost", () => {
  it("is a draft while the card never went to the client", () => {
    expect(statusFromPost(post())).toBe("rascunho");
  });

  it("is in review once the card was sent", () => {
    expect(statusFromPost(post({ approval: { round: 1, decisions: [] } }))).toBe("em_revisao");
  });

  it("is approved when the client approved the card", () => {
    const approved = post({
      approval: {
        round: 1,
        decisions: [{ id: "d1", round: 1, result: "approved", verified: true, at: NOW }],
      },
    });
    expect(statusFromPost(approved)).toBe("aprovado");
  });

  it("goes back to review when the client asked for changes", () => {
    const changes = post({
      approval: {
        round: 2,
        decisions: [
          { id: "d1", round: 1, result: "approved", verified: true, at: NOW },
          { id: "d2", round: 2, result: "changes", comment: "trocar a capa", verified: true, at: NOW },
        ],
      },
    });
    expect(statusFromPost(changes)).toBe("em_revisao");
  });

  it("counts a published card as approved even with no decision recorded", () => {
    expect(statusFromPost(post({ status: "published" }))).toBe("aprovado");
  });
});

describe("nextVersion", () => {
  it("bumps the version on a save", () => {
    const out = nextVersion(script({ version: 3 }));
    expect("conflict" in out).toBe(false);
    expect((out as Script).version).toBe(4);
  });

  it("refuses a save made over someone else's newer version", () => {
    const mine = script({ version: 2 });
    const stored = script({ version: 5 });
    expect(nextVersion(mine, stored)).toEqual({ conflict: true });
  });

  it("accepts a save over the same version it read", () => {
    const mine = script({ version: 5 });
    expect("conflict" in nextVersion(mine, script({ version: 5 }))).toBe(false);
  });
});

describe("toPlainText", () => {
  const s = script({
    goal: "Vender o combo",
    tone: "Leve",
    scenes: [
      scene({ shot: "Close", seconds: 6, speech: "Bom dia!", onScreen: "Combo novo", notes: "SEGREDO: pedir desconto da gráfica" }),
    ],
  });

  it("writes a script anyone can read out loud", () => {
    const text = toPlainText(s);
    expect(text).toContain("Objetivo: Vender o combo");
    expect(text).toContain("Cena 1 (Close · 6s)");
    expect(text).toContain("Fala: Bom dia!");
    expect(text).toContain("Tela: Combo novo");
  });

  it("never carries the internal notes out", () => {
    expect(toPlainText(s)).not.toContain("SEGREDO");
  });

  it("calls a stories screen a screen", () => {
    const stories = script({ kind: "stories", scenes: [scene({ screenKind: "enquete", seconds: 5 })] });
    expect(toPlainText(stories)).toContain("Tela 1 (Enquete · 5s)");
  });
});
