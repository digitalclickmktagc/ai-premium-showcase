import { describe, expect, it } from "vitest";
import {
  DEFAULT_VALIDITY_DAYS,
  canTransition,
  daysToExpiry,
  defaultValidUntil,
  expiringSoon,
  installmentPlan,
  isEditable,
  isExpired,
  isRecurring,
  itemFromService,
  itemTotal,
  nextProposalNumber,
  proposalTotals,
  validatePaymentTerms,
  validateProposal,
} from "./proposals";
import type { PaymentTerms, Proposal, ProposalItem, Service } from "./types";

const item = (over: Partial<ProposalItem> = {}): ProposalItem => ({
  id: "i1",
  description: "Gestão de redes",
  quantity: 1,
  unitPrice: 150000, // R$ 1.500,00
  billing: "mensal",
  ...over,
});

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  id: "p1",
  title: "Proposta Aurora",
  clientId: "cli1",
  validUntil: "2026-12-31",
  status: "enviada",
  linkId: "tok",
  items: [item()],
  views: [],
  version: 1,
  createdAt: "t",
  updatedAt: "t",
  ...over,
});

describe("totals", () => {
  it("normalises an annual item to a month — the spec's own example", () => {
    // R$ 1.200 a year is R$ 100 a month.
    const totals = proposalTotals([item({ unitPrice: 120000, billing: "anual" })]);
    expect(totals.recurringMonthly).toBe(10000);
    expect(totals.oneOff).toBe(0);
  });

  it("normalises every recurring period", () => {
    expect(proposalTotals([item({ unitPrice: 30000, billing: "trimestral" })]).recurringMonthly).toBe(10000);
    expect(proposalTotals([item({ unitPrice: 60000, billing: "semestral" })]).recurringMonthly).toBe(10000);
    expect(proposalTotals([item({ unitPrice: 10000, billing: "mensal" })]).recurringMonthly).toBe(10000);
  });

  it("keeps one-off and hourly out of the recurring figure", () => {
    const totals = proposalTotals([
      item({ unitPrice: 150000, billing: "mensal" }),
      item({ id: "i2", unitPrice: 80000, billing: "unica" }),
      item({ id: "i3", unitPrice: 15000, billing: "por_hora", quantity: 10 }),
    ]);
    expect(totals.recurringMonthly).toBe(150000);
    expect(totals.oneOff).toBe(80000 + 150000);
  });

  it("multiplies by the quantity", () => {
    expect(itemTotal(item({ quantity: 3, unitPrice: 10000 }))).toBe(30000);
  });

  it("gives the first-year commitment", () => {
    const totals = proposalTotals([
      item({ unitPrice: 100000, billing: "mensal" }),
      item({ id: "i2", unitPrice: 50000, billing: "unica" }),
    ]);
    expect(totals.firstYear).toBe(50000 + 100000 * 12);
  });

  it("knows which kinds recur", () => {
    expect(isRecurring("mensal")).toBe(true);
    expect(isRecurring("anual")).toBe(true);
    expect(isRecurring("unica")).toBe(false);
    expect(isRecurring("por_hora")).toBe(false);
  });

  it("has nothing to add up for an empty proposal", () => {
    expect(proposalTotals([])).toEqual({ recurringMonthly: 0, oneOff: 0, firstYear: 0 });
  });
});

describe("payment terms", () => {
  const terms = (over: Partial<PaymentTerms> = {}): PaymentTerms => ({
    modality: "parcelado",
    entryAmount: 0,
    installments: 3,
    methods: ["pix"],
    ...over,
  });

  it("splits the financed part so it adds back up exactly", () => {
    const parts = installmentPlan(terms({ installments: 3 }), 29999);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(29999);
    expect(parts).toEqual([9999, 9999, 10001]);
  });

  it("takes the entry off the top before splitting", () => {
    const parts = installmentPlan(terms({ entryAmount: 50000, installments: 2 }), 150000);
    expect(parts).toEqual([50000, 50000]);
    expect(parts.reduce((a, b) => a + b, 0) + 50000).toBe(150000);
  });

  it("has no instalments when it is paid in full", () => {
    expect(installmentPlan(terms({ modality: "a_vista" }), 100000)).toEqual([]);
    expect(installmentPlan(terms({ entryAmount: 100000 }), 100000)).toEqual([]);
  });

  it("refuses an entry larger than the proposal", () => {
    expect(validatePaymentTerms(terms({ entryAmount: 200000 }), 100000)).toMatch(/maior/);
    expect(validatePaymentTerms(terms({ entryAmount: -1 }), 100000)).toBeTruthy();
  });

  it("keeps the instalment count inside what the spec allows", () => {
    expect(validatePaymentTerms(terms({ installments: 1 }), 100000)).toBeTruthy();
    expect(validatePaymentTerms(terms({ installments: 61 }), 100000)).toBeTruthy();
    expect(validatePaymentTerms(terms({ installments: 60 }), 100000)).toBeNull();
  });

  it("insists on a way to pay", () => {
    expect(validatePaymentTerms(terms({ methods: [] }), 100000)).toBeTruthy();
  });
});

describe("numbering", () => {
  it("counts up per year", () => {
    expect(nextProposalNumber([], 2026)).toBe("2026-001");
    expect(
      nextProposalNumber([proposal({ number: "2026-001" }), proposal({ number: "2026-002" })], 2026),
    ).toBe("2026-003");
  });

  it("starts over in a new year", () => {
    expect(nextProposalNumber([proposal({ number: "2025-009" })], 2026)).toBe("2026-001");
  });

  it("ignores drafts, which never hold a number", () => {
    expect(nextProposalNumber([proposal({ number: undefined })], 2026)).toBe("2026-001");
  });

  it("does not reuse a number after a gap", () => {
    expect(nextProposalNumber([proposal({ number: "2026-007" })], 2026)).toBe("2026-008");
  });
});

describe("state machine", () => {
  it("walks the path the spec draws", () => {
    expect(canTransition("rascunho", "enviada")).toBe(true);
    expect(canTransition("enviada", "aceita")).toBe(true);
    expect(canTransition("enviada", "ajuste_pedido")).toBe(true);
    expect(canTransition("ajuste_pedido", "enviada")).toBe(true);
    expect(canTransition("vencida", "enviada")).toBe(true);
  });

  it("treats an accepted proposal as the end of the line", () => {
    for (const to of ["rascunho", "enviada", "recusada", "arquivada"] as const) {
      expect(canTransition("aceita", to)).toBe(false);
    }
    expect(isEditable(proposal({ status: "aceita" }))).toBe(false);
    expect(isEditable(proposal({ status: "enviada" }))).toBe(true);
  });

  it("refuses to jump straight from a draft to accepted", () => {
    expect(canTransition("rascunho", "aceita")).toBe(false);
  });
});

describe("validity", () => {
  it("lapses only once sent and past the date", () => {
    expect(isExpired(proposal({ validUntil: "2026-01-01" }), "2026-06-01")).toBe(true);
    expect(isExpired(proposal({ validUntil: "2026-12-01" }), "2026-06-01")).toBe(false);
    // a draft cannot lapse
    expect(isExpired(proposal({ status: "rascunho", validUntil: "2020-01-01" }), "2026-06-01")).toBe(false);
  });

  it("counts the days left, negative once past", () => {
    expect(daysToExpiry(proposal({ validUntil: "2026-06-10" }), "2026-06-01")).toBe(9);
    expect(daysToExpiry(proposal({ validUntil: "2026-05-30" }), "2026-06-01")).toBe(-2);
  });

  it("warns in the last week, and not before", () => {
    expect(expiringSoon(proposal({ validUntil: "2026-06-05" }), "2026-06-01")).toBe(true);
    expect(expiringSoon(proposal({ validUntil: "2026-06-20" }), "2026-06-01")).toBe(false);
    expect(expiringSoon(proposal({ validUntil: "2026-05-30" }), "2026-06-01")).toBe(false);
  });

  it("defaults to a fortnight and a day", () => {
    const from = new Date("2026-06-01T12:00:00Z");
    expect(defaultValidUntil(from)).toBe("2026-06-16");
    expect(DEFAULT_VALIDITY_DAYS).toBe(15);
  });
});

describe("validation", () => {
  it("wants a title, a recipient and at least one item", () => {
    expect(validateProposal({ ...proposal(), title: " " })).toBeTruthy();
    expect(validateProposal({ ...proposal(), clientId: undefined, leadName: undefined })).toBeTruthy();
    expect(validateProposal({ ...proposal(), items: [] })).toBeTruthy();
    expect(validateProposal(proposal())).toBeNull();
  });

  it("accepts a lead with no client record", () => {
    expect(
      validateProposal({ ...proposal(), clientId: undefined, leadName: "Padaria do Zé" }),
    ).toBeNull();
  });

  it("refuses a nonsense item", () => {
    expect(validateProposal({ ...proposal(), items: [item({ quantity: 0 })] })).toBeTruthy();
    expect(validateProposal({ ...proposal(), items: [item({ unitPrice: -1 })] })).toBeTruthy();
    expect(validateProposal({ ...proposal(), items: [item({ description: " " })] })).toBeTruthy();
  });
});

describe("itemFromService", () => {
  it("carries price, billing and scope over from the catalogue", () => {
    const service: Service = {
      id: "s1",
      name: "Gestão de redes",
      price: 150000,
      billing: "mensal",
      active: true,
      publicInTable: true,
      order: 0,
      included: ["12 posts", "4 reels"],
      createdAt: "t",
    };
    expect(itemFromService(service)).toEqual({
      serviceId: "s1",
      description: "Gestão de redes",
      quantity: 1,
      unitPrice: 150000,
      billing: "mensal",
      scope: "12 posts\n4 reels",
    });
  });
});
