import { describe, expect, it } from "vitest";
import {
  autoMatch,
  buildImport,
  entryFromLine,
  ignoreLine,
  lineKey,
  parseAmount,
  parseStatement,
  reconcile,
  suggestMatches,
  summarise,
  textAffinity,
  undoReconcile,
  unignoreLine,
} from "./statement";
import type { FinanceEntry, StatementLine } from "./types";

const NOW = "2026-07-01T10:00:00.000Z";

function line(over: Partial<StatementLine> = {}): StatementLine {
  return {
    id: "l1",
    accountId: "acc1",
    key: "k1",
    date: "2026-07-05",
    description: "PIX RECEBIDO AURORA CAFE",
    amount: 180000,
    status: "a_conferir",
    createdAt: NOW,
    ...over,
  };
}

function entry(over: Partial<FinanceEntry> = {}): FinanceEntry {
  return {
    id: "e1",
    nature: "receita",
    description: "Mensalidade Aurora",
    amount: 180000,
    dueDate: "2026-07-05",
    competence: "2026-07",
    status: "pendente",
    origin: "manual",
    createdAt: NOW,
    ...over,
  };
}

describe("parseAmount", () => {
  it("reads Brazilian and English notation, and the sign", () => {
    expect(parseAmount("1.234,56")).toBe(123456);
    expect(parseAmount("-1.234,56")).toBe(-123456);
    expect(parseAmount("1,234.56")).toBe(123456);
    expect(parseAmount("(1.234,56)")).toBe(-123456);
    expect(parseAmount("R$ 50,00")).toBe(5000);
    expect(parseAmount("+120")).toBe(12000);
  });

  it("refuses what is not a number", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("parseStatement — CSV", () => {
  it("reads a header in any column order", () => {
    const csv = [
      "Histórico;Data;Valor",
      "PIX RECEBIDO;05/07/2026;1.800,00",
      "TARIFA MENSAL;06/07/2026;-39,90",
    ].join("\n");
    const out = parseStatement(csv);
    expect(out.errors).toEqual([]);
    expect(out.lines).toEqual([
      { date: "2026-07-05", description: "PIX RECEBIDO", amount: 180000, externalId: undefined },
      { date: "2026-07-06", description: "TARIFA MENSAL", amount: -3990, externalId: undefined },
    ]);
  });

  it("reads separate credit and debit columns", () => {
    const csv = ["Data,Descrição,Crédito,Débito", "05/07/2026,Mensalidade,1800.00,", "06/07/2026,Tarifa,,39.90"].join("\n");
    const out = parseStatement(csv);
    expect(out.lines.map((l) => l.amount)).toEqual([180000, -3990]);
  });

  it("reports the lines it could not read, by number, and keeps the rest", () => {
    const csv = ["Data;Descrição;Valor", "05/07/2026;Boa;10,00", "sem data;Ruim;abc"].join("\n");
    const out = parseStatement(csv);
    expect(out.lines).toHaveLength(1);
    expect(out.errors[0]).toMatch(/Linha 3/);
  });

  it("copes with a file that has no header", () => {
    const out = parseStatement("05/07/2026;Mensalidade;1.800,00");
    expect(out.lines[0]).toMatchObject({ date: "2026-07-05", amount: 180000 });
  });

  it("keeps a separator that lives inside quotes", () => {
    const csv = ['Data;Descrição;Valor', '05/07/2026;"PIX, enviado";-10,00'].join("\n");
    expect(parseStatement(csv).lines[0].description).toBe("PIX, enviado");
  });
});

describe("parseStatement — OFX", () => {
  const ofx = `
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260705120000[-3:BRT]<TRNAMT>1800.00<FITID>ABC123<MEMO>PIX AURORA</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260706120000<TRNAMT>-39.90<FITID>ABC124<NAME>TARIFA</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  it("reads transactions with their bank id", () => {
    const out = parseStatement(ofx);
    expect(out.lines).toEqual([
      { date: "2026-07-05", description: "PIX AURORA", amount: 180000, externalId: "ABC123" },
      { date: "2026-07-06", description: "TARIFA", amount: -3990, externalId: "ABC124" },
    ]);
  });
});

describe("buildImport", () => {
  const parsed = {
    lines: [
      { date: "2026-07-05", description: "PIX", amount: 180000, externalId: "ABC123" },
      { date: "2026-07-06", description: "TARIFA", amount: -3990 },
    ],
    errors: [],
  };

  it("imports what is new", () => {
    let n = 0;
    const out = buildImport("acc1", parsed, [], NOW, () => `l${(n += 1)}`);
    expect(out.fresh).toHaveLength(2);
    expect(out.duplicates).toBe(0);
    expect(out.fresh[0]).toMatchObject({ accountId: "acc1", status: "a_conferir", key: "ABC123" });
  });

  it("does not import the same file twice", () => {
    const first = buildImport("acc1", parsed, [], NOW);
    const second = buildImport("acc1", parsed, first.fresh, NOW);
    expect(second.fresh).toEqual([]);
    expect(second.duplicates).toBe(2);
  });

  it("keeps accounts apart: the same transaction in another account is new", () => {
    const first = buildImport("acc1", parsed, [], NOW);
    const other = buildImport("acc2", parsed, first.fresh, NOW);
    expect(other.fresh).toHaveLength(2);
  });

  it("does not collapse two identical transactions in the same file", () => {
    const twice = {
      lines: [
        { date: "2026-07-05", description: "PIX", amount: 1000, externalId: "X1" },
        { date: "2026-07-05", description: "PIX", amount: 1000, externalId: "X2" },
      ],
      errors: [],
    };
    expect(buildImport("acc1", twice, [], NOW).fresh).toHaveLength(2);
  });

  it("falls back to date, value and text when the bank gives no id", () => {
    expect(lineKey("acc1", { date: "2026-07-05", description: " Pix ", amount: 100 })).toBe(
      "acc1|2026-07-05|100|pix",
    );
  });
});

describe("suggestMatches", () => {
  it("only looks at entries of the same value and the same direction", () => {
    const entries = [
      entry({ id: "same" }),
      entry({ id: "other-value", amount: 100 }),
      entry({ id: "expense", nature: "despesa" }),
    ];
    expect(suggestMatches(line(), entries).map((s) => s.entry.id)).toEqual(["same"]);
  });

  it("is most confident on the same day, less as the days grow", () => {
    const entries = [
      entry({ id: "sameday", dueDate: "2026-07-05", description: "x" }),
      entry({ id: "close", dueDate: "2026-07-08", description: "x" }),
      entry({ id: "far", dueDate: "2026-09-05", description: "x" }),
    ];
    const out = suggestMatches(line({ description: "y" }), entries);
    expect(out.map((s) => s.entry.id)).toEqual(["sameday", "close", "far"]);
    expect(out[0].confidence).toBeGreaterThan(out[1].confidence);
    expect(out[1].confidence).toBeGreaterThan(out[2].confidence);
    expect(out[0].reason).toBe("mesmo valor, mesmo dia");
  });

  it("gives a nudge to a description that looks alike", () => {
    const plain = suggestMatches(line({ description: "TED 0001" }), [entry({ description: "x" })]);
    const alike = suggestMatches(line(), [entry({ description: "Mensalidade Aurora" })]);
    expect(alike[0].confidence).toBeGreaterThan(plain[0].confidence);
    expect(alike[0].reason).toMatch(/descrição parecida/);
  });

  it("ignores cancelled entries and reversals", () => {
    const entries = [
      entry({ id: "cancelled", status: "cancelado" }),
      entry({ id: "reversal", reversalOf: "e0" }),
    ];
    expect(suggestMatches(line(), entries)).toEqual([]);
  });

  it("measures how much two descriptions share", () => {
    expect(textAffinity("PIX MENSALIDADE AURORA", "Mensalidade Aurora")).toBeGreaterThan(0.5);
    expect(textAffinity("TARIFA", "Mensalidade")).toBe(0);
  });
});

describe("autoMatch", () => {
  it("applies the one strong match by itself", () => {
    const out = suggestMatches(line(), [entry()]);
    expect(autoMatch(out)?.entry.id).toBe("e1");
  });

  it("refuses to choose between two entries of the same value", () => {
    const entries = [entry({ id: "a" }), entry({ id: "b" })];
    expect(autoMatch(suggestMatches(line(), entries))).toBeNull();
  });

  it("refuses a weak match", () => {
    const far = entry({ dueDate: "2026-10-01" });
    expect(autoMatch(suggestMatches(line(), [far]))).toBeNull();
  });
});

describe("reconcile", () => {
  it("settles the entry on the bank's date, in the statement's account", () => {
    const out = reconcile(line(), entry(), NOW);
    expect(out.entry).toMatchObject({
      status: "liquidado",
      settledAt: "2026-07-05",
      accountId: "acc1",
    });
    expect(out.line).toMatchObject({ status: "conferida", entryId: "e1", settledEntry: true });
  });

  it("keeps the account the entry already had", () => {
    const out = reconcile(line(), entry({ accountId: "outra" }), NOW);
    expect(out.entry.accountId).toBe("outra");
  });

  it("links without touching an entry someone had already settled", () => {
    const settled = entry({ status: "liquidado", settledAt: "2026-07-01" });
    const out = reconcile(line(), settled, NOW);
    expect(out.entry).toBe(settled);
    expect(out.line.settledEntry).toBe(false);
  });
});

describe("undoReconcile", () => {
  it("unlinks and reverses the settlement it made", () => {
    const { line: linked, entry: settled } = reconcile(line(), entry(), NOW);
    const out = undoReconcile(linked, settled);
    expect(out.line).toMatchObject({ status: "a_conferir", entryId: undefined });
    expect(out.entry).toMatchObject({ status: "pendente", settledAt: undefined });
  });

  it("never reverses a settlement a person made by hand", () => {
    const byHand = entry({ status: "liquidado", settledAt: "2026-07-01" });
    const { line: linked } = reconcile(line(), byHand, NOW);
    const out = undoReconcile(linked, byHand);
    expect(out.line.status).toBe("a_conferir");
    expect(out.entry).toBeUndefined();
  });
});

describe("ignore", () => {
  it("is reversible", () => {
    const ignored = ignoreLine(line());
    expect(ignored.status).toBe("ignorada");
    expect(unignoreLine(ignored).status).toBe("a_conferir");
  });
});

describe("entryFromLine", () => {
  it("is born settled, on the bank's date and account", () => {
    const made = entryFromLine(line({ amount: -3990, description: "TARIFA" }), {}, NOW, "e9");
    expect(made).toMatchObject({
      id: "e9",
      nature: "despesa",
      amount: 3990,
      dueDate: "2026-07-05",
      competence: "2026-07",
      status: "liquidado",
      settledAt: "2026-07-05",
      accountId: "acc1",
      origin: "extrato",
    });
  });

  it("names a line with no description instead of leaving it blank", () => {
    expect(entryFromLine(line({ description: "   " })).description).toBe("Lançamento do extrato");
  });
});

describe("summarise", () => {
  it("counts the three states and what is still open", () => {
    const lines = [
      line({ id: "a", amount: 1000 }),
      line({ id: "b", amount: -500 }),
      line({ id: "c", status: "conferida" }),
      line({ id: "d", status: "ignorada" }),
    ];
    expect(summarise(lines)).toEqual({
      total: 4,
      pending: 2,
      reconciled: 1,
      ignored: 1,
      pendingAmount: 500,
    });
  });
});
