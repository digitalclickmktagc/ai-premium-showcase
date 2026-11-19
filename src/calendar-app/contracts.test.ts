import { describe, expect, it } from "vitest";
import {
  canEditText,
  daysToRenewal,
  deriveStatus,
  evidenceSummary,
  hashText,
  isEffective,
  missingVariables,
  needsRenewalNotice,
  pendingParties,
  renderTemplate,
  signaturesMatchText,
  validateParties,
  validateSignature,
} from "./contracts";
import type { Contract, ContractParty, Signature } from "./types";

const party = (over: Partial<ContractParty> = {}): ContractParty => ({
  id: "pa1",
  role: "contratante",
  name: "Aurora Café LTDA",
  document: "12345678000190",
  order: 0,
  required: true,
  token: "tok1",
  ...over,
});

const signature = (over: Partial<Signature> = {}): Signature => ({
  id: "s1",
  partyId: "pa1",
  typedName: "Ana Aurora",
  typedDocument: "12345678901",
  at: "2026-06-10T10:00:00.000Z",
  signedTextHash: "HASH",
  ...over,
});

const contract = (over: Partial<Contract> = {}): Contract => ({
  id: "c1",
  title: "Contrato Aurora",
  status: "aguardando_partes",
  finalText: "texto",
  textHash: "HASH",
  autoRenew: false,
  renewNoticeDays: 30,
  parties: [
    party(),
    party({ id: "pa2", role: "contratada", name: "Digital Click", order: 1 }),
  ],
  signatures: [],
  createdAt: "t",
  ...over,
});

describe("hashText", () => {
  it("is the real SHA-256", async () => {
    // Known vector: SHA-256("abc").
    expect(await hashText("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("changes completely when one character changes", async () => {
    const a = await hashText("Contrato de prestação de serviços");
    const b = await hashText("Contrato de prestação de serviço");
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe("template", () => {
  it("fills in what it knows", () => {
    expect(
      renderTemplate("Entre {{cliente.nome}} e {{agencia.nome}}.", {
        "cliente.nome": "Aurora",
        "agencia.nome": "Digital Click",
      }),
    ).toBe("Entre Aurora e Digital Click.");
  });

  it("leaves an unknown variable visible rather than blanking it", () => {
    const out = renderTemplate("Entre {{cliente.nome}} e {{agencia.nome}}.", {
      "cliente.nome": "Aurora",
    });
    expect(out).toBe("Entre Aurora e {{agencia.nome}}.");
    expect(missingVariables(out)).toEqual(["agencia.nome"]);
  });

  it("treats an empty value as missing too", () => {
    expect(missingVariables(renderTemplate("{{x}}", { x: "" }))).toEqual(["x"]);
  });

  it("tolerates spaces inside the braces", () => {
    expect(renderTemplate("{{ cliente.nome }}", { "cliente.nome": "Aurora" })).toBe("Aurora");
  });
});

describe("parties", () => {
  it("wants a contratante, a contratada and two witnesses, as decided", () => {
    expect(validateParties([party()])).toMatch(/contratada/);
    expect(validateParties([party({ role: "contratada" })])).toMatch(/contratante/);
    expect(validateParties(contract().parties)).toMatch(/testemunha/);

    const withWitnesses = [
      ...contract().parties,
      party({ id: "w1", role: "testemunha", name: "T1", order: 2, required: false }),
      party({ id: "w2", role: "testemunha", name: "T2", order: 3, required: false }),
    ];
    expect(validateParties(withWitnesses)).toBeNull();
  });

  it("can be told to skip the witness rule", () => {
    expect(validateParties(contract().parties, { requireWitnesses: false })).toBeNull();
  });

  it("refuses a party with no name", () => {
    expect(
      validateParties([party({ name: "  " }), party({ id: "x", role: "contratada" })], {
        requireWitnesses: false,
      }),
    ).toMatch(/nome/);
  });

  it("lists who is still missing, in order", () => {
    const c = contract({ signatures: [signature()] });
    expect(pendingParties(c).map((p) => p.id)).toEqual(["pa2"]);
  });
});

describe("effect", () => {
  it("takes effect only when every required party has signed", () => {
    const partial = contract({ signatures: [signature()] });
    expect(deriveStatus(partial)).toBe("parcialmente_assinado");
    expect(isEffective(partial)).toBe(false);

    const full = contract({
      signatures: [signature(), signature({ id: "s2", partyId: "pa2" })],
    });
    expect(deriveStatus(full)).toBe("vigente");
    expect(isEffective(full)).toBe(true);
  });

  it("ignores a witness for the operational trigger when they are optional", () => {
    const c = contract({
      parties: [
        ...contract().parties,
        party({ id: "w1", role: "testemunha", name: "T1", order: 2, required: false }),
      ],
      signatures: [signature(), signature({ id: "s2", partyId: "pa2" })],
    });
    expect(isEffective(c)).toBe(true);
  });

  it("never takes effect when a signature was given to different text", () => {
    const tampered = contract({
      signatures: [
        signature(),
        signature({ id: "s2", partyId: "pa2", signedTextHash: "OUTRO" }),
      ],
    });
    expect(signaturesMatchText(tampered)).toBe(false);
    expect(deriveStatus(tampered)).toBe("parcialmente_assinado");
    expect(isEffective(tampered)).toBe(false);
  });

  it("leaves a cancelled or closed contract where it is", () => {
    expect(deriveStatus(contract({ status: "cancelado" }))).toBe("cancelado");
    expect(deriveStatus(contract({ status: "encerrado" }))).toBe("encerrado");
  });

  it("says 'awaiting' while nobody has signed", () => {
    expect(deriveStatus(contract())).toBe("aguardando_partes");
  });
});

describe("text is frozen by the first signature", () => {
  it("allows editing while nobody has signed", () => {
    expect(canEditText(contract())).toBe(true);
  });

  it("refuses once anyone has", () => {
    expect(canEditText(contract({ signatures: [signature()] }))).toBe(false);
  });

  it("refuses on a cancelled contract", () => {
    expect(canEditText(contract({ status: "cancelado" }))).toBe(false);
  });
});

describe("validateSignature", () => {
  it("wants a full name and a real document length", () => {
    expect(validateSignature({ typedName: "An", typedDocument: "12345678901" })).toBeTruthy();
    expect(validateSignature({ typedName: "Ana Aurora", typedDocument: "123" })).toBeTruthy();
    expect(validateSignature({ typedName: "Ana Aurora", typedDocument: "123.456.789-01" })).toBeNull();
    expect(validateSignature({ typedName: "Aurora LTDA", typedDocument: "12.345.678/0001-90" })).toBeNull();
  });
});

describe("renewal", () => {
  const vigente = () =>
    contract({
      endsOn: "2026-07-01",
      renewNoticeDays: 30,
      signatures: [signature(), signature({ id: "s2", partyId: "pa2" })],
    });

  it("counts the days to the end", () => {
    expect(daysToRenewal(vigente(), "2026-06-01")).toBe(30);
    expect(daysToRenewal(contract(), "2026-06-01")).toBeNull();
  });

  it("warns inside the notice window, and not before", () => {
    expect(needsRenewalNotice(vigente(), "2026-06-01")).toBe(true);
    expect(needsRenewalNotice(vigente(), "2026-05-01")).toBe(false);
  });

  it("does not warn about a contract that never took effect", () => {
    expect(needsRenewalNotice(contract({ endsOn: "2026-07-01" }), "2026-06-25")).toBe(false);
  });
});

describe("evidence", () => {
  it("records who signed, with what document, when and against which hash", () => {
    const c = contract({ signatures: [signature({ agent: "Chrome" })] });
    const lines = evidenceSummary(c);
    expect(lines[0]).toContain("Ana Aurora");
    expect(lines[0]).toContain("12345678901");
    expect(lines[0]).toContain("Chrome");
    expect(lines[0]).toContain("HASH".slice(0, 16));
    expect(lines[1]).toContain("não assinou");
  });
});
