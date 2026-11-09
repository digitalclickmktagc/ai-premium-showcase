import { describe, expect, it } from "vitest";
import {
  MAX_STAGES,
  canAddStage,
  canRemoveStage,
  dropPatch,
  groupByStage,
  isStandard,
  moveStage,
  resolveStages,
  stageForPost,
  standardStages,
  usesCustomStages,
  validateStageName,
} from "./stages";
import type { BoardStage, Post } from "./types";

const stage = (over: Partial<BoardStage> = {}): BoardStage => ({
  id: "s1",
  calendarId: "cal1",
  name: "Gravação",
  color: "#3b82f6",
  category: "done",
  order: 0,
  ...over,
});

const post = (over: Partial<Post> = {}): Post => ({
  id: "p1",
  calendarId: "cal1",
  title: "Post",
  date: "2026-06-10",
  status: "done",
  description: "",
  rescheduleHistory: [],
  createdAt: "t",
  updatedAt: "t",
  ...over,
});

describe("resolveStages", () => {
  it("falls back to the four standard stages when the calendar has none", () => {
    const stages = resolveStages("cal1", []);
    expect(stages.map((s) => s.category)).toEqual([
      "todo",
      "done",
      "published",
      "rescheduled",
    ]);
    expect(stages.every(isStandard)).toBe(true);
  });

  it("uses the calendar's own columns, in their order", () => {
    const custom = [
      stage({ id: "b", name: "Edição", order: 1 }),
      stage({ id: "a", name: "Roteiro", order: 0, category: "todo" }),
    ];
    expect(resolveStages("cal1", custom).map((s) => s.name)).toEqual([
      "Roteiro",
      "Edição",
    ]);
  });

  it("ignores another calendar's columns", () => {
    const custom = [stage({ id: "x", calendarId: "cal2" })];
    expect(resolveStages("cal1", custom).every(isStandard)).toBe(true);
    expect(usesCustomStages("cal1", custom)).toBe(false);
    expect(usesCustomStages("cal2", custom)).toBe(true);
  });
});

describe("stageForPost", () => {
  const stages = [
    stage({ id: "a", name: "Roteiro", category: "todo", order: 0 }),
    stage({ id: "b", name: "Gravação", category: "done", order: 1 }),
    stage({ id: "c", name: "Edição", category: "done", order: 2 }),
  ];

  it("keeps the column the card claims", () => {
    expect(stageForPost(post({ stageId: "c" }), stages)?.id).toBe("c");
  });

  it("falls back to the first column of the card's status when the claim is stale", () => {
    // the column was deleted
    expect(stageForPost(post({ stageId: "gone" }), stages)?.id).toBe("b");
    // the status was changed from the edit form and no longer matches
    expect(stageForPost(post({ stageId: "c", status: "todo" }), stages)?.id).toBe("a");
  });

  it("returns nothing when no column stands for the card's status", () => {
    expect(stageForPost(post({ status: "published" }), stages)).toBeUndefined();
  });
});

describe("groupByStage", () => {
  const stages = [
    stage({ id: "a", category: "todo", order: 0 }),
    stage({ id: "b", category: "done", order: 1 }),
  ];

  it("puts each card in its column, soonest first", () => {
    const grouped = groupByStage(
      [
        post({ id: "p2", status: "done", date: "2026-06-20" }),
        post({ id: "p1", status: "done", date: "2026-06-10" }),
        post({ id: "p3", status: "todo", date: "2026-06-15" }),
      ],
      stages,
    );
    expect(grouped.get("b")!.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(grouped.get("a")!.map((p) => p.id)).toEqual(["p3"]);
  });

  it("drops cards no column stands for instead of inventing a home", () => {
    const grouped = groupByStage([post({ status: "deleted" })], stages);
    expect([...grouped.values()].flat()).toEqual([]);
  });

  it("gives every column an entry, even an empty one", () => {
    expect([...groupByStage([], stages).keys()]).toEqual(["a", "b"]);
  });
});

describe("dropPatch", () => {
  it("writes the status the column stands for, plus the column itself", () => {
    expect(dropPatch(post({ status: "todo" }), stage({ id: "s9", category: "done" })))
      .toEqual({ status: "done", stageId: "s9" });
  });

  it("clears the column when the card is dropped on a standard stage", () => {
    const [todo] = standardStages("cal1");
    expect(dropPatch(post({ status: "done", stageId: "s1" }), todo)).toEqual({
      status: "todo",
      stageId: undefined,
    });
  });

  it("reports nothing to do when the card is already there", () => {
    expect(dropPatch(post({ status: "done", stageId: "s1" }), stage({ id: "s1" }))).toBeNull();
  });

  it("still moves a card between two columns of the same status", () => {
    // "Gravação" and "Edição" are both em progresso: the status does not
    // change, but the card has to move.
    expect(
      dropPatch(post({ status: "done", stageId: "s1" }), stage({ id: "s2", category: "done" })),
    ).toEqual({ status: "done", stageId: "s2" });
  });
});

describe("guard rails", () => {
  it("refuses an empty, overlong or duplicated name", () => {
    const existing = [stage({ id: "a", name: "Roteiro" })];
    expect(validateStageName("  ", existing)).toBeTruthy();
    expect(validateStageName("x".repeat(41), existing)).toBeTruthy();
    expect(validateStageName("roteiro", existing)).toMatch(/Já existe/);
    expect(validateStageName("Roteiro", existing, "a")).toBeNull(); // renaming itself
    expect(validateStageName("Edição", existing)).toBeNull();
  });

  it("caps how many columns a board may have", () => {
    expect(canAddStage([])).toBeNull();
    expect(canAddStage(Array.from({ length: MAX_STAGES }, (_, i) => stage({ id: String(i) }))))
      .toBeTruthy();
  });

  it("refuses to remove the last column standing for a status", () => {
    const only = [stage({ id: "a", category: "todo" }), stage({ id: "b", category: "done" })];
    expect(canRemoveStage(only[0], only)).toMatch(/única coluna/);

    const two = [...only, stage({ id: "c", category: "done", name: "Edição" })];
    expect(canRemoveStage(two[1], two)).toBeNull();
  });

  it("refuses to empty the board", () => {
    const one = [stage({ id: "a" })];
    expect(canRemoveStage(one[0], one)).toBeTruthy();
  });
});

describe("moveStage", () => {
  const stages = [
    stage({ id: "a", order: 0 }),
    stage({ id: "b", order: 1 }),
    stage({ id: "c", order: 2 }),
  ];

  it("swaps with the neighbour and renumbers", () => {
    expect(moveStage(stages, "b", -1).map((s) => [s.id, s.order])).toEqual([
      ["b", 0],
      ["a", 1],
      ["c", 2],
    ]);
  });

  it("does nothing at the ends", () => {
    expect(moveStage(stages, "a", -1).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(moveStage(stages, "c", 1).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});
