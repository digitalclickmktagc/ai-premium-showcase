import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEALTH_WEIGHTS,
  isLate,
  isOpen,
  lateCount,
  projectFromContract,
  projectPosts,
  projectProgress,
  projectResult,
  squadClients,
  squadHealth,
  squadProjects,
  validateProject,
  validateSquad,
  validateWeights,
} from "./projects";
import type { FinanceEntry, Post, Project, Squad } from "./types";

const NOW = "2026-06-01T10:00:00.000Z";
const TODAY = "2026-06-10";

function project(over: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Gestão de redes",
    clientId: "c1",
    value: 500000,
    status: "ativo",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function post(over: Partial<Post> = {}): Post {
  return {
    id: "post1",
    calendarId: "cal1",
    title: "Card",
    date: "2026-06-05",
    status: "todo",
    description: "",
    rescheduleHistory: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function entry(over: Partial<FinanceEntry> = {}): FinanceEntry {
  return {
    id: "e1",
    nature: "receita",
    description: "Mensalidade",
    amount: 100000,
    dueDate: "2026-06-05",
    competence: "2026-06",
    status: "liquidado",
    origin: "manual",
    createdAt: NOW,
    ...over,
  };
}

function squad(over: Partial<Squad> = {}): Squad {
  return { id: "s1", name: "Squad A", members: [], createdAt: NOW, updatedAt: NOW, ...over };
}

describe("validation", () => {
  it("demands a name, a client and a value that makes sense", () => {
    expect(validateProject(project({ name: " " }))).toMatch(/nome/);
    expect(validateProject(project({ clientId: "" }))).toMatch(/cliente/);
    expect(validateProject(project({ value: -1 }))).toMatch(/negativo/);
    expect(validateProject(project({ dueDate: "30/06" }))).toMatch(/Prazo/);
    expect(validateProject(project())).toBeNull();
  });

  it("refuses a squad with no name or with the same person twice", () => {
    expect(validateSquad(squad({ name: "" }))).toMatch(/nome/);
    expect(validateSquad(squad({ members: ["Ana", " ana "] }))).toMatch(/repetidos/);
    expect(validateSquad(squad({ members: ["Ana", "Bruno"] }))).toBeNull();
  });

  it("demands weights that add up to 100", () => {
    expect(validateWeights({ prazo: 50, progresso: 40, entrega: 20 })).toMatch(/somam 110/);
    expect(validateWeights(DEFAULT_HEALTH_WEIGHTS)).toBeNull();
  });
});

describe("progress", () => {
  it("counts published and done cards over the project's cards", () => {
    const posts = [
      post({ id: "a", projectId: "p1", status: "published" }),
      post({ id: "b", projectId: "p1", status: "done" }),
      post({ id: "c", projectId: "p1", status: "todo" }),
      post({ id: "d", projectId: "p2", status: "published" }),
    ];
    expect(projectProgress(project(), posts)).toEqual({ done: 2, total: 3, percent: 67 });
  });

  it("ignores deleted cards", () => {
    const posts = [
      post({ id: "a", projectId: "p1", status: "published" }),
      post({ id: "b", projectId: "p1", status: "deleted" }),
    ];
    expect(projectPosts(posts, "p1")).toHaveLength(1);
    expect(projectProgress(project(), posts).percent).toBe(100);
  });

  it("returns null, not 0%, for a project with no card", () => {
    expect(projectProgress(project(), []).percent).toBeNull();
  });
});

describe("late", () => {
  it("is late past the deadline while the project is open", () => {
    expect(isLate(project({ dueDate: "2026-06-01" }), TODAY)).toBe(true);
    expect(isLate(project({ dueDate: "2026-06-30" }), TODAY)).toBe(false);
  });

  it("is never late once concluded or cancelled", () => {
    expect(isLate(project({ dueDate: "2026-06-01", status: "concluido" }), TODAY)).toBe(false);
    expect(isLate(project({ dueDate: "2026-06-01", status: "cancelado" }), TODAY)).toBe(false);
    expect(isOpen(project({ status: "pausado" }))).toBe(true);
  });

  it("is never late with no deadline", () => {
    expect(isLate(project(), TODAY)).toBe(false);
  });

  it("counts the late ones", () => {
    const list = [
      project({ id: "a", dueDate: "2026-06-01" }),
      project({ id: "b", dueDate: "2026-07-01" }),
      project({ id: "c", dueDate: "2026-06-01", status: "concluido" }),
    ];
    expect(lateCount(list, TODAY)).toBe(1);
  });
});

describe("result by project", () => {
  it("counts only settled entries", () => {
    const entries = [
      entry({ id: "a", projectId: "p1", amount: 300000 }),
      entry({ id: "b", projectId: "p1", nature: "despesa", amount: 100000 }),
      entry({ id: "c", projectId: "p1", amount: 999999, status: "previsto" }),
      entry({ id: "d", projectId: "p2", amount: 500000 }),
    ];
    expect(projectResult(entries, "p1")).toEqual({
      revenue: 300000,
      cost: 100000,
      balance: 200000,
      margin: 67,
    });
  });

  it("gives no margin when nothing came in", () => {
    const entries = [entry({ id: "a", projectId: "p1", nature: "despesa", amount: 5000 })];
    expect(projectResult(entries, "p1")).toMatchObject({ revenue: 0, balance: -5000, margin: null });
  });
});

describe("squads", () => {
  const projects = [
    project({ id: "a", squadId: "s1", clientId: "c1" }),
    project({ id: "b", squadId: "s1", clientId: "c2" }),
    project({ id: "c", squadId: "s1", clientId: "c1" }),
    project({ id: "d", clientId: "c3" }),
  ];

  it("lists its projects and its clients, without repeating a client", () => {
    expect(squadProjects(projects, "s1").map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(squadClients(projects, "s1")).toEqual(["c1", "c2"]);
  });
});

describe("squad health", () => {
  it("is null when there is nothing to measure", () => {
    expect(squadHealth("s1", [], [], DEFAULT_HEALTH_WEIGHTS, TODAY).score).toBeNull();
  });

  it("is 100 when everything is on time, finished and delivered", () => {
    const projects = [project({ id: "a", squadId: "s1", dueDate: "2026-07-01" })];
    const posts = [
      post({ id: "x", projectId: "a", status: "published" }),
      post({ id: "y", projectId: "a", status: "done" }),
    ];
    const health = squadHealth("s1", projects, posts, DEFAULT_HEALTH_WEIGHTS, TODAY);
    expect(health.score).toBe(100);
    expect(health.parts.map((p) => p.value)).toEqual([100, 100, 100]);
  });

  it("explains every component in words", () => {
    const projects = [
      project({ id: "a", squadId: "s1", dueDate: "2026-06-01" }),
      project({ id: "b", squadId: "s1", dueDate: "2026-07-01" }),
    ];
    const posts = [
      post({ id: "x", projectId: "a", status: "published" }),
      post({ id: "y", projectId: "a", status: "todo" }),
    ];
    const health = squadHealth("s1", projects, posts, DEFAULT_HEALTH_WEIGHTS, TODAY);
    expect(health.parts[0].detail).toBe("1 de 2 projeto(s) aberto(s) dentro do prazo");
    expect(health.parts[0].value).toBe(50);
    expect(health.parts[1].detail).toBe("média de 1 projeto(s) com card");
    expect(health.parts[2].detail).toBe("1 de 2 card(s) publicados ou feitos");
    expect(health.score).toBe(50);
  });

  it("redistributes the weight of a component with no base instead of scoring it zero", () => {
    // A squad whose projects have no cards yet: only "prazo" can be measured,
    // so the score is that component alone — not 40 out of 100.
    const projects = [project({ id: "a", squadId: "s1", dueDate: "2026-07-01" })];
    const health = squadHealth("s1", projects, [], DEFAULT_HEALTH_WEIGHTS, TODAY);
    expect(health.score).toBe(100);
    expect(health.parts[0].weight).toBe(100);
    expect(health.parts[1].value).toBeNull();
    expect(health.parts[1].points).toBe(0);
  });

  it("follows the agency's weights", () => {
    const projects = [
      project({ id: "a", squadId: "s1", dueDate: "2026-06-01" }),
      project({ id: "b", squadId: "s1", dueDate: "2026-07-01" }),
    ];
    const posts = [post({ id: "x", projectId: "a", status: "published" })];
    const only = squadHealth("s1", projects, posts, { prazo: 100, progresso: 0, entrega: 0 }, TODAY);
    expect(only.score).toBe(50);
  });

  it("never counts another squad's work", () => {
    const projects = [
      project({ id: "a", squadId: "s1", dueDate: "2026-07-01" }),
      project({ id: "b", squadId: "s2", dueDate: "2026-06-01" }),
    ];
    expect(squadHealth("s1", projects, [], DEFAULT_HEALTH_WEIGHTS, TODAY).score).toBe(100);
  });
});

describe("projectFromContract", () => {
  it("opens an active project tied to the contract", () => {
    const p = projectFromContract("c1", "ctr1", "Gestão", 1200000, NOW, "p9");
    expect(p).toMatchObject({
      id: "p9",
      clientId: "c1",
      contractId: "ctr1",
      name: "Gestão",
      value: 1200000,
      status: "ativo",
    });
  });
});
