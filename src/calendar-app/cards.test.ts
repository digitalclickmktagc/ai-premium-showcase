import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_NAME_MAX,
  CHECKLIST_TEXT_MAX,
  COMMENT_MAX,
  TIME_ENTRY_MAX_MINUTES,
  buildAttachment,
  checklistProgress,
  formatDuration,
  newChecklistItem,
  newComment,
  newTimeEntry,
  parseDuration,
  sortComments,
  toggleChecklistItem,
  totalMinutes,
  validateChecklistText,
  validateComment,
  validateDuration,
} from "./cards";
import type { ChecklistItem, PostComment } from "./types";

describe("checklist", () => {
  const items: ChecklistItem[] = [
    { id: "a", text: "Gravar", done: true },
    { id: "b", text: "Editar", done: false },
    { id: "c", text: "Legendar", done: false },
  ];

  it("counts progress and rounds the percentage", () => {
    expect(checklistProgress(items)).toEqual({
      done: 1,
      total: 3,
      percent: 33,
      complete: false,
    });
  });

  it("treats an empty list as 'nothing to do', not as 'done'", () => {
    expect(checklistProgress([])).toMatchObject({ percent: 0, complete: false });
    expect(checklistProgress(undefined)).toMatchObject({ total: 0, complete: false });
  });

  it("is complete only when every item is ticked", () => {
    const all = items.map((i) => ({ ...i, done: true }));
    expect(checklistProgress(all)).toMatchObject({ percent: 100, complete: true });
  });

  it("toggles one item and leaves the others alone", () => {
    const next = toggleChecklistItem(items, "b");
    expect(next.map((i) => i.done)).toEqual([true, true, false]);
    expect(items.map((i) => i.done)).toEqual([true, false, false]); // no mutation
  });

  it("ignores a toggle for an id that is not there", () => {
    expect(toggleChecklistItem(items, "zzz")).toEqual(items);
  });

  it("trims the text and starts the item unticked", () => {
    const item = newChecklistItem("  Gravar o reels  ");
    expect(item.text).toBe("Gravar o reels");
    expect(item.done).toBe(false);
    expect(item.id).toBeTruthy();
  });

  it("refuses empty text and text past the limit", () => {
    expect(validateChecklistText("   ")).toBeTruthy();
    expect(validateChecklistText("a".repeat(CHECKLIST_TEXT_MAX + 1))).toBeTruthy();
    expect(validateChecklistText("Gravar")).toBeNull();
  });
});

describe("comments", () => {
  it("refuses an empty comment and one past the limit", () => {
    expect(validateComment("  ")).toBeTruthy();
    expect(validateComment("x".repeat(COMMENT_MAX + 1))).toBeTruthy();
    expect(validateComment("Trocar a foto de capa")).toBeNull();
  });

  it("records who wrote it, falling back to a neutral author", () => {
    expect(newComment("texto", "Ana").author).toBe("Ana");
    expect(newComment("texto", "   ").author).toBe("Equipe");
  });

  it("shows the newest first", () => {
    const list: PostComment[] = [
      { id: "1", author: "A", body: "antigo", at: "2026-11-01T10:00:00.000Z" },
      { id: "2", author: "B", body: "novo", at: "2026-11-05T10:00:00.000Z" },
    ];
    expect(sortComments(list).map((c) => c.id)).toEqual(["2", "1"]);
    expect(sortComments(undefined)).toEqual([]);
  });
});

describe("attachments", () => {
  it("keeps a normal link and the name given", () => {
    const res = buildAttachment("Briefing", "https://drive.google.com/x");
    expect("attachment" in res && res.attachment).toMatchObject({
      name: "Briefing",
      url: "https://drive.google.com/x",
    });
  });

  it("falls back to the host when no name is typed", () => {
    const res = buildAttachment("  ", "https://www.dropbox.com/s/abc");
    expect("attachment" in res && res.attachment.name).toBe("dropbox.com");
  });

  it("assumes https for a bare host", () => {
    const res = buildAttachment("Pasta", "drive.google.com/abc");
    expect("attachment" in res && res.attachment.url).toBe("https://drive.google.com/abc");
  });

  it("refuses a javascript: link — an attachment must never become a click", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "   ",
    ]) {
      const res = buildAttachment("x", bad);
      expect("error" in res).toBe(true);
    }
  });

  it("refuses a name past the limit", () => {
    const res = buildAttachment("n".repeat(ATTACHMENT_NAME_MAX + 1), "https://x.com");
    expect("error" in res).toBe(true);
  });
});

describe("time", () => {
  it("reads a duration the way a person writes one", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("1h30")).toBe(90);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("2h")).toBe(120);
    expect(parseDuration("45m")).toBe(45);
    expect(parseDuration("45min")).toBe(45);
    expect(parseDuration("1,5h")).toBe(90);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration(" 2H15 ")).toBe(135);
  });

  it("returns null for what it cannot read", () => {
    for (const bad of ["", "   ", "abc", "1h75", "10:99", "--", "1h30m20"]) {
      expect(parseDuration(bad)).toBeNull();
    }
  });

  it("rejects zero, nonsense and more than a day", () => {
    expect(validateDuration("0")).toBeTruthy();
    expect(validateDuration("abc")).toBeTruthy();
    expect(validateDuration(String(TIME_ENTRY_MAX_MINUTES + 1))).toBeTruthy();
    expect(validateDuration("90")).toBeNull();
    expect(validateDuration(String(TIME_ENTRY_MAX_MINUTES))).toBeNull();
  });

  it("drops an empty note instead of storing whitespace", () => {
    expect(newTimeEntry(30, "   ").note).toBeUndefined();
    expect(newTimeEntry(30, " editar ").note).toBe("editar");
  });

  it("adds the entries up, tolerating a missing list", () => {
    expect(totalMinutes()).toBe(0);
    expect(
      totalMinutes([
        { id: "1", minutes: 30, at: "t" },
        { id: "2", minutes: 45, at: "t" },
      ]),
    ).toBe(75);
  });

  it("formats the way the team speaks", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(45)).toBe("45min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(125)).toBe("2h05");
  });
});
