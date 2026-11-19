import type {
  ContractingProcess,
  Proposal,
  SagaStep,
  SagaStepKey,
} from "./types";

/**
 * Sale → operation orchestrator (benchmark spec 10).
 *
 * A long-running process, written as a saga: each step is idempotent, the
 * state is persisted after every step, and a failure stops the chain without
 * undoing what already worked. Re-running the same acceptance must not create
 * a second client, a second contract or a second billing series — which is
 * why every step records the ids it created and checks for them first.
 *
 * The money rule is the one that matters most: **nothing financial exists
 * before the contract is in force.** An accepted proposal is a promise; a
 * signed contract is an obligation, and only the second one bills.
 */

export const STEP_ORDER: SagaStepKey[] = [
  "resolver_cliente",
  "gerar_contrato",
  "aguardar_assinaturas",
  "ativar_servicos",
  "criar_financeiro",
  "criar_quadro",
  "concluir",
];

export const STEP_LABEL: Record<SagaStepKey, string> = {
  resolver_cliente: "Identificar o cliente",
  gerar_contrato: "Gerar o contrato",
  aguardar_assinaturas: "Aguardar as assinaturas",
  ativar_servicos: "Ativar os serviços contratados",
  criar_financeiro: "Criar as cobranças",
  criar_quadro: "Preparar o calendário",
  concluir: "Concluir",
};

export function newProcess(proposal: Proposal, dealId?: string): ContractingProcess {
  return {
    id: `proc_${proposal.id}`,
    proposalId: proposal.id,
    dealId,
    clientId: proposal.clientId,
    status: "em_andamento",
    steps: STEP_ORDER.map((key) => ({ key, status: "pendente", attempts: 0 })),
    startedAt: new Date().toISOString(),
  };
}

/** Everything the saga needs from the rest of the system. */
export interface SagaContext {
  /** Existing client id, or create one and return it. Must be idempotent. */
  resolveClient: (proposal: Proposal) => Promise<string>;
  /** Returns the contract id, creating it only if this process has none. */
  generateContract: (proposal: Proposal, clientId: string) => Promise<string>;
  /** Whether that contract is in force (every required party signed). */
  isContractEffective: (contractId: string) => boolean;
  /** Record the contracted services; returns their ids. */
  activateServices: (proposal: Proposal, contractId: string) => Promise<string[]>;
  /** Create the billing series; returns their ids. */
  createBilling: (proposal: Proposal, clientId: string) => Promise<string[]>;
  /** Make sure the client has a calendar to work in; returns its id. */
  ensureBoard: (clientId: string) => Promise<string>;
  /** Mark the deal won. */
  markDealWon: (dealId: string, proposal: Proposal) => Promise<void>;
  now?: () => string;
}

function stepOf(process: ContractingProcess, key: SagaStepKey): SagaStep {
  return (
    process.steps.find((s) => s.key === key) ?? { key, status: "pendente", attempts: 0 }
  );
}

function withStep(
  process: ContractingProcess,
  key: SagaStepKey,
  patch: Partial<SagaStep>,
): ContractingProcess {
  return {
    ...process,
    steps: process.steps.map((s) => (s.key === key ? { ...s, ...patch } : s)),
  };
}

/**
 * Advance the process as far as it can go right now.
 *
 * Returns the new state; the caller persists it. Steps already done are
 * skipped, so calling this again is always safe — and is exactly how a retry
 * after a failure works.
 */
export async function advanceProcess(
  input: ContractingProcess,
  proposal: Proposal,
  ctx: SagaContext,
): Promise<ContractingProcess> {
  const now = ctx.now ?? (() => new Date().toISOString());
  let process = { ...input };

  if (process.status === "cancelado" || process.status === "concluido") return process;

  for (const key of STEP_ORDER) {
    const step = stepOf(process, key);
    if (step.status === "feito" || step.status === "pulado") continue;

    try {
      switch (key) {
        case "resolver_cliente": {
          const clientId = step.result?.clientId ?? (await ctx.resolveClient(proposal));
          process = { ...process, clientId };
          process = withStep(process, key, {
            status: "feito",
            attempts: step.attempts + 1,
            result: { clientId },
            at: now(),
          });
          break;
        }

        case "gerar_contrato": {
          const clientId = process.clientId!;
          const contractId =
            step.result?.contractId ?? (await ctx.generateContract(proposal, clientId));
          process = withStep(process, key, {
            status: "feito",
            attempts: step.attempts + 1,
            result: { contractId },
            at: now(),
          });
          break;
        }

        case "aguardar_assinaturas": {
          const contractId = stepOf(process, "gerar_contrato").result?.contractId;
          if (!contractId || !ctx.isContractEffective(contractId)) {
            // Not a failure: the process simply waits. Nothing financial has
            // happened and nothing will until this clears.
            //
            // Returning the process *unchanged* matters. A caller that saves
            // the result on every check would otherwise rewrite the row each
            // time, and a reload-on-write would spin forever.
            if (process.status === "aguardando_assinatura") return input;
            return {
              ...withStep(process, key, { attempts: step.attempts + 1, at: now() }),
              status: "aguardando_assinatura",
            };
          }
          process = withStep(process, key, {
            status: "feito",
            attempts: step.attempts + 1,
            at: now(),
          });
          process = { ...process, status: "em_andamento" };
          break;
        }

        case "ativar_servicos": {
          const contractId = stepOf(process, "gerar_contrato").result!.contractId!;
          const ids = step.result?.serviceIds
            ? step.result.serviceIds.split(",").filter(Boolean)
            : await ctx.activateServices(proposal, contractId);
          process = withStep(process, key, {
            status: "feito",
            attempts: step.attempts + 1,
            result: { serviceIds: ids.join(",") },
            at: now(),
          });
          break;
        }

        case "criar_financeiro": {
          const ids = step.result?.seriesIds
            ? step.result.seriesIds.split(",").filter(Boolean)
            : await ctx.createBilling(proposal, process.clientId!);
          process = withStep(process, key, {
            status: "feito",
            attempts: step.attempts + 1,
            result: { seriesIds: ids.join(",") },
            at: now(),
          });
          break;
        }

        case "criar_quadro": {
          const calendarId =
            step.result?.calendarId ?? (await ctx.ensureBoard(process.clientId!));
          process = withStep(process, key, {
            status: "feito",
            attempts: step.attempts + 1,
            result: { calendarId },
            at: now(),
          });
          break;
        }

        case "concluir": {
          if (process.dealId) await ctx.markDealWon(process.dealId, proposal);
          process = withStep(process, key, {
            status: "feito",
            attempts: step.attempts + 1,
            at: now(),
          });
          process = { ...process, status: "concluido", finishedAt: now() };
          break;
        }
      }
    } catch (err) {
      // The step failed. Everything before it stays done, and a retry picks
      // up exactly here — no compensation, because nothing half-finished was
      // written: each step either records its ids or did nothing.
      return {
        ...withStep(process, key, {
          status: "falhou",
          attempts: step.attempts + 1,
          detail: err instanceof Error ? err.message : String(err),
          at: now(),
        }),
        status: "falhou",
      };
    }
  }

  return process;
}

/**
 * A process worth looking at again.
 *
 * `aguardando_assinatura` belongs here: waiting is precisely the state that
 * has to be re-checked, because the thing it waits for — the last required
 * signature — happens somewhere else entirely, in a signatory's browser.
 * Leaving it out means a contract goes into force and the process never
 * notices.
 */
export function isActionable(process: ContractingProcess): boolean {
  return (
    process.status === "em_andamento" ||
    process.status === "falhou" ||
    process.status === "aguardando_assinatura"
  );
}

export function progressOf(process: ContractingProcess): { done: number; total: number } {
  return {
    done: process.steps.filter((s) => s.status === "feito").length,
    total: process.steps.length,
  };
}

export function failedStep(process: ContractingProcess): SagaStep | undefined {
  return process.steps.find((s) => s.status === "falhou");
}

/**
 * Proposals that were accepted and have no process yet.
 *
 * The client accepts in their own browser, where nothing may touch the
 * agency's data. The saga therefore starts the next time the agency's app
 * loads — the same catch-up shape the post automations use.
 */
export function proposalsAwaitingProcess(
  proposals: Proposal[],
  processes: ContractingProcess[],
): Proposal[] {
  const started = new Set(processes.map((p) => p.proposalId));
  return proposals.filter((p) => p.status === "aceita" && !started.has(p.id));
}
