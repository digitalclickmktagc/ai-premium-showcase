import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatMoneyShort,
  parseMoney,
  percentOf,
  splitInstallments,
} from "./money";

describe("parseMoney", () => {
  it("reads the way Brazilians write money", () => {
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("R$ 1.234,56")).toBe(123456);
    expect(parseMoney("1234,5")).toBe(123450);
    expect(parseMoney("1200")).toBe(120000);
    expect(parseMoney("0,99")).toBe(99);
  });

  it("also reads the way a spreadsheet exports it", () => {
    expect(parseMoney("1234.56")).toBe(123456);
    expect(parseMoney("1,234.56")).toBe(123456);
  });

  it("returns null for what is not a number", () => {
    for (const bad of ["", "   ", "abc", "R$", "12a3"]) {
      expect(parseMoney(bad)).toBeNull();
    }
  });

  it("never loses a cent to floating point", () => {
    // 0.1 + 0.2 territory: these are the values that bite.
    expect(parseMoney("1,10")).toBe(110);
    expect(parseMoney("8,20")).toBe(820);
    expect(parseMoney("1850,70")).toBe(185070);
  });
});

describe("formatMoney", () => {
  it("writes it back the same way", () => {
    expect(formatMoney(123456)).toBe("R$ 1.234,56");
    expect(formatMoney(99)).toBe("R$ 0,99");
    expect(formatMoney(0)).toBe("R$ 0,00");
    expect(formatMoney(-5000)).toBe("-R$ 50,00");
    expect(formatMoney(123456, false)).toBe("1.234,56");
  });

  it("shortens big numbers for dense tables", () => {
    expect(formatMoneyShort(50000)).toBe("R$ 500,00");
    expect(formatMoneyShort(450000)).toBe("R$ 4,5 mil");
    expect(formatMoneyShort(250000000)).toBe("R$ 2,5 mi");
  });
});

describe("splitInstallments", () => {
  it("always adds back up to the total", () => {
    for (const [total, n] of [
      [100000, 3],
      [29999, 3],
      [100, 7],
      [1, 2],
      [123456, 12],
    ] as const) {
      const parts = splitInstallments(total, n);
      expect(parts).toHaveLength(n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("puts the remainder on the last part", () => {
    expect(splitInstallments(100000, 3)).toEqual([33333, 33333, 33334]);
    expect(splitInstallments(29999, 3)).toEqual([9999, 9999, 10001]);
  });

  it("gives nothing back for a nonsense count", () => {
    expect(splitInstallments(1000, 0)).toEqual([]);
    expect(splitInstallments(1000, -1)).toEqual([]);
  });
});

describe("percentOf", () => {
  it("rounds to the cent", () => {
    expect(percentOf(10000, 10)).toBe(1000);
    expect(percentOf(3333, 50)).toBe(1667);
  });
});
