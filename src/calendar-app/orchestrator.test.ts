import { describe, expect, it, vi } from "vitest";
import {
  STEP_ORDER,
  advanceProcess,
  isActionable,
  failedStep,
  newProcess,
  progressOf,
  proposalsAwaitingProcess,
} from "./orchestrator";
import type { ContractingProcess, Proposal } from "./types";
import type { SagaContext as Ctx } from "./orchestrator";

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  id: "p1",
  title: "Proposta",
  leadName: "Padaria do Zé",
  validUntil: "2026-12-31",
  status: "aceita",
  linkId: "tok",
  items: [
    { id: "i1", description: "Gestão", quantity: 1, unitPrice: 150000, billing: "mensal" },
  ],
  views: [],
  version: 1,
  createdAt: "t",
  updatedAt: "t",
  ...over,
});

function makeCtx(over: Partial<Ctx> = {}): Ctx & {
  calls: Record<string, number>;
} {
  const calls: Record<string, number> = {};
  const count = (k: string) => {
    calls[k] = (calls[k] ?? 0) + 1;
  };
  return {
    calls,
    resolveClient: vi.fn(async () => {
      count("resolveClient");
      return "cli1";
    }),
    generateContract: vi.fn(async () => {
      count("generateContract");
      return "ctr1";
    }),
    isContractEffective: () => true,
    activateServices: vi.fn(async () => {
      count("activateServices");
      return ["svc1"];
    }),
    createBilling: vi.fn(async () => {
      count("createBilling");
      return ["ser1"];
    }),
    ensureBoard: vi.fn(async () => {
      count("ensureBoard");
      return "cal1";
    }),
    markDealWon: vi.fn(async () => {
      count("markDealWon");
    }),
    now: () => "2026-06-10T10:00:00.000Z",
    ...over,
  };
}

describe("newProcess", () => {
  it("lays out every step as pending", () => {
    const p = newProcess(proposal());
    expect(p.steps.map((s) => s.key)).toEqual(STEP_ORDER);
    expect(p.steps.every((s) => s.status === "pendente")).toBe(true);
    expect(p.status).toBe("em_andamento");
  });

  it("is keyed by the proposal, so the same acceptance has one process", () => {
    expect(newProcess(proposal()).id).toBe(newProcess(proposal()).id);
  });
});

describe("happy path", () => {
  it("walks every step and ends concluded", async () => {
    const ctx = makeCtx();
    const done = await advanceProcess(newProcess(proposal(), "deal1"), proposal(), ctx);

    expect(done.status).toBe("concluido");
    expect(done.steps.every((s) => s.status === "feito")).toBe(true);
    expect(progressOf(done)).toEqual({ done: STEP_ORDER.length, total: STEP_ORDER.length });
    expect(done.clientId).toBe("cli1");
    expect(ctx.markDealWon).toHaveBeenCalled();
  });

  it("records what each step created", async () => {
    const ctx = makeCtx();
    const done = await advanceProcess(newProcess(proposal()), proposal(), ctx);
    expect(done.steps.find((s) => s.key === "gerar_contrato")?.result).toEqual({
      contractId: "ctr1",
    });
    expect(done.steps.find((s) => s.key === "criar_financeiro")?.result).toEqual({
      seriesIds: "ser1",
    });
  });
});

describe("waiting for signatures", () => {
  it("stops and waits, with nothing financial done", async () => {
    const ctx = makeCtx({ isContractEffective: () => false });
    const waiting = await advanceProcess(newProcess(proposal()), proposal(), ctx);

    expect(waiting.status).toBe("aguardando_assinatura");
    expect(waiting.steps.find((s) => s.key === "gerar_contrato")?.status).toBe("feito");
    expect(waiting.steps.find((s) => s.key === "criar_financeiro")?.status).toBe("pendente");
    // the spec's hard rule: no money before the contract is in force
    expect(ctx.createBilling).not.toHaveBeenCalled();
  });

  it("stays on the list of things to look at while it waits", () => {
    // The last signature happens in a signatory's browser, somewhere else
    // entirely. A waiting process that nobody looks at again would never
    // notice the contract coming into force.
    const waiting = { ...newProcess(proposal()), status: "aguardando_assinatura" as const };
    expect(isActionable(waiting)).toBe(true);
    expect(isActionable({ ...waiting, status: "concluido" })).toBe(false);
    expect(isActionable({ ...waiting, status: "cancelado" })).toBe(false);
  });

  it("returns the very same object while it is still waiting", async () => {
    // Identity matters: the caller uses it to decide whether to write. A new
    // object on every check would rewrite the row, reload, and check again.
    const ctx = makeCtx({ isContractEffective: () => false });
    const waiting = await advanceProcess(newProcess(proposal()), proposal(), ctx);
    const again = await advanceProcess(waiting, proposal(), ctx);
    expect(again).toBe(waiting);
  });

  it("carries on from where it stopped once the contract is in force", async () => {
    const waitingCtx = makeCtx({ isContractEffective: () => false });
    const waiting = await advanceProcess(newProcess(proposal()), proposal(), waitingCtx);

    const signedCtx = makeCtx();
    const done = await advanceProcess(waiting, proposal(), signedCtx);

    expect(done.status).toBe("concluido");
    // the client and the contract were not created a second time
    expect(signedCtx.resolveClient).not.toHaveBeenCalled();
    expect(signedCtx.generateContract).not.toHaveBeenCalled();
    expect(signedCtx.createBilling).toHaveBeenCalledTimes(1);
  });
});

describe("idempotency", () => {
  it("re-running a finished process changes nothing", async () => {
    const ctx = makeCtx();
    const done = await advanceProcess(newProcess(proposal()), proposal(), ctx);
    const again = await advanceProcess(done, proposal(), ctx);

    expect(again).toEqual(done);
    expect(ctx.calls.resolveClient).toBe(1);
    expect(ctx.calls.createBilling).toBe(1);
  });

  it("never creates a second client, contract or series on a retry", async () => {
    const ctx = makeCtx();
    let process = await advanceProcess(newProcess(proposal()), proposal(), ctx);
    process = await advanceProcess(process, proposal(), ctx);
    process = await advanceProcess(process, proposal(), ctx);

    expect(ctx.calls.resolveClient).toBe(1);
    expect(ctx.calls.generateContract).toBe(1);
    expect(ctx.calls.createBilling).toBe(1);
    expect(ctx.calls.ensureBoard).toBe(1);
  });
});

describe("failure and retry", () => {
  it("stops at the failing step and keeps the earlier ones done", async () => {
    const ctx = makeCtx({
      ensureBoard: vi.fn(async () => {
        throw new Error("calendário indisponível");
      }),
    });
    const failed = await advanceProcess(newProcess(proposal()), proposal(), ctx);

    expect(failed.status).toBe("falhou");
    expect(failedStep(failed)?.key).toBe("criar_quadro");
    expect(failedStep(failed)?.detail).toBe("calendário indisponível");
    for (const key of ["resolver_cliente", "gerar_contrato", "ativar_servicos", "criar_financeiro"] as const) {
      expect(failed.steps.find((s) => s.key === key)?.status).toBe("feito");
    }
    expect(failed.steps.find((s) => s.key === "concluir")?.status).toBe("pendente");
  });

  it("a retry completes without duplicating the earlier work", async () => {
    const failing = makeCtx({
      ensureBoard: vi.fn(async () => {
        throw new Error("falha temporária");
      }),
    });
    const failed = await advanceProcess(newProcess(proposal(), "deal1"), proposal(), failing);

    const working = makeCtx();
    const done = await advanceProcess(failed, proposal(), working);

    expect(done.status).toBe("concluido");
    expect(working.calls.resolveClient).toBeUndefined();
    expect(working.calls.createBilling).toBeUndefined();
    expect(working.calls.ensureBoard).toBe(1);
  });

  it("counts the attempts on the step that failed", async () => {
    const ctx = makeCtx({
      ensureBoard: vi.fn(async () => {
        throw new Error("de novo não");
      }),
    });
    let process = await advanceProcess(newProcess(proposal()), proposal(), ctx);
    process = await advanceProcess(process, proposal(), ctx);
    expect(failedStep(process)?.attempts).toBe(2);
  });
});

describe("proposalsAwaitingProcess", () => {
  it("picks up accepted proposals that have no process yet", () => {
    const accepted = proposal({ id: "a" });
    const draft = proposal({ id: "b", status: "rascunho" });
    const started = proposal({ id: "c" });
    const processes: ContractingProcess[] = [
      { ...newProcess(started), proposalId: "c" },
    ];
    expect(proposalsAwaitingProcess([accepted, draft, started], processes).map((p) => p.id)).toEqual([
      "a",
    ]);
  });
});
