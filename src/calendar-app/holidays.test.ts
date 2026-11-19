import { describe, expect, it } from "vitest";
import { easterSunday, markedDatesFor, markedDatesInMonth } from "./holidays";

describe("easterSunday", () => {
  // Checked against the published dates, including a 19-year gap and a
  // March Easter, which is where a wrong algorithm usually shows itself.
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2030, "2030-04-21"],
    [2038, "2038-04-25"],
  ])("gets Easter %i right", (year, expected) => {
    expect(easterSunday(year).toISOString().slice(0, 10)).toBe(expected);
  });
});

describe("markedDatesFor", () => {
  const dates = markedDatesFor(2026);
  const byName = (name: string) => dates.find((d) => d.name === name);

  it("derives the movable feasts from Easter", () => {
    // Easter 2026 is 5 April.
    expect(byName("Sexta-feira Santa")?.date).toBe("2026-04-03");
    expect(byName("Carnaval")?.date).toBe("2026-02-17");
    expect(byName("Corpus Christi")?.date).toBe("2026-06-04");
  });

  it("puts the fixed national holidays where they belong", () => {
    expect(byName("Natal")?.date).toBe("2026-12-25");
    expect(byName("Consciência Negra")?.date).toBe("2026-11-20");
    expect(byName("Independência do Brasil")?.date).toBe("2026-09-07");
  });

  it("includes the Distrito Federal dates, as decided", () => {
    expect(byName("Fundação de Brasília")?.date).toBe("2026-04-21");
    expect(byName("Dia do Evangélico (DF)")?.date).toBe("2026-11-30");
    expect(dates.filter((d) => d.category === "Feriado DF")).toHaveLength(2);
  });

  it("computes the nth-weekday commercial dates", () => {
    // 2nd Sunday of May 2026 is the 10th; 2nd Sunday of August is the 9th.
    expect(byName("Dia das Mães")?.date).toBe("2026-05-10");
    expect(byName("Dia dos Pais")?.date).toBe("2026-08-09");
    // Thanksgiving 2026 is 26 Nov, so Black Friday is the 27th.
    expect(byName("Black Friday")?.date).toBe("2026-11-27");
    expect(byName("Cyber Monday")?.date).toBe("2026-11-30");
  });

  it("flags the dates a brand should think twice about", () => {
    expect(byName("Finados")?.sensitive).toBe(true);
    expect(byName("Setembro Amarelo")?.sensitive).toBe(true);
    expect(byName("Black Friday")?.sensitive).toBeUndefined();
  });

  it("gives every entry a stable id and comes back sorted", () => {
    const again = markedDatesFor(2026);
    expect(again.map((d) => d.id)).toEqual(dates.map((d) => d.id));
    const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
    expect(dates.map((d) => d.id)).toEqual(sorted.map((d) => d.id));
  });

  it("keeps two different dates that share a day apart", () => {
    // 21 April is both Tiradentes and the founding of Brasília.
    const sameDay = dates.filter((d) => d.date === "2026-04-21");
    expect(sameDay).toHaveLength(2);
    expect(new Set(sameDay.map((d) => d.id)).size).toBe(2);
  });
});

describe("markedDatesInMonth", () => {
  it("returns only that month", () => {
    const dez = markedDatesInMonth("2026-12");
    expect(dez.length).toBeGreaterThan(0);
    expect(dez.every((d) => d.date.startsWith("2026-12"))).toBe(true);
  });

  it("shrugs off a malformed month", () => {
    expect(markedDatesInMonth("nope")).toEqual([]);
  });
});
