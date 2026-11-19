import type { MarkedDate } from "./types";

/**
 * Catalogue of marked dates (benchmark spec 04, `data_marcante`).
 *
 * Scope is national plus Distrito Federal, as decided (D5). It is computed
 * per year rather than stored, so there is no table to keep topped up and no
 * year that silently runs out of holidays.
 *
 * Commercial dates sit here next to the holidays on purpose: for a social
 * media agency, Dia das Mães drives more work than Tiradentes does.
 */

export type MarkedCategory =
  | "Feriado nacional"
  | "Feriado DF"
  | "Ponto facultativo"
  | "Data comercial"
  | "Data comemorativa";

const COLOR: Record<MarkedCategory, string> = {
  "Feriado nacional": "#ef4444",
  "Feriado DF": "#f97316",
  "Ponto facultativo": "#a78bfa",
  "Data comercial": "#22c55e",
  "Data comemorativa": "#38bdf8",
};

/** Easter Sunday, anonymous Gregorian algorithm. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function offset(from: Date, days: number): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

function fixed(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Nth weekday of a month, e.g. the 2nd Sunday of May. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + shift + (nth - 1) * 7;
  return fixed(year, month, day);
}

/** The Friday after the fourth Thursday of November (US Thanksgiving). */
function blackFriday(year: number): string {
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  const d = new Date(`${thanksgiving}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}

interface Entry {
  name: string;
  date: string;
  category: MarkedCategory;
  sensitive?: boolean;
}

/** Every marked date of a year, sorted. */
export function markedDatesFor(year: number): MarkedDate[] {
  const easter = easterSunday(year);

  const entries: Entry[] = [
    // ── Feriados nacionais ──
    { name: "Confraternização Universal", date: fixed(year, 1, 1), category: "Feriado nacional" },
    { name: "Carnaval", date: offset(easter, -47), category: "Ponto facultativo" },
    { name: "Sexta-feira Santa", date: offset(easter, -2), category: "Feriado nacional", sensitive: true },
    { name: "Páscoa", date: iso(easter), category: "Data comemorativa", sensitive: true },
    { name: "Tiradentes", date: fixed(year, 4, 21), category: "Feriado nacional" },
    { name: "Dia do Trabalho", date: fixed(year, 5, 1), category: "Feriado nacional" },
    { name: "Corpus Christi", date: offset(easter, 60), category: "Ponto facultativo", sensitive: true },
    { name: "Independência do Brasil", date: fixed(year, 9, 7), category: "Feriado nacional" },
    { name: "Nossa Senhora Aparecida", date: fixed(year, 10, 12), category: "Feriado nacional", sensitive: true },
    { name: "Finados", date: fixed(year, 11, 2), category: "Feriado nacional", sensitive: true },
    { name: "Proclamação da República", date: fixed(year, 11, 15), category: "Feriado nacional" },
    { name: "Consciência Negra", date: fixed(year, 11, 20), category: "Feriado nacional", sensitive: true },
    { name: "Natal", date: fixed(year, 12, 25), category: "Feriado nacional" },

    // ── Distrito Federal ──
    { name: "Fundação de Brasília", date: fixed(year, 4, 21), category: "Feriado DF" },
    { name: "Dia do Evangélico (DF)", date: fixed(year, 11, 30), category: "Feriado DF", sensitive: true },

    // ── Datas comerciais ──
    { name: "Dia das Mães", date: nthWeekday(year, 5, 0, 2), category: "Data comercial" },
    { name: "Dia dos Namorados", date: fixed(year, 6, 12), category: "Data comercial" },
    { name: "Dia dos Pais", date: nthWeekday(year, 8, 0, 2), category: "Data comercial" },
    { name: "Dia do Cliente", date: fixed(year, 9, 15), category: "Data comercial" },
    { name: "Dia das Crianças", date: fixed(year, 10, 12), category: "Data comercial" },
    { name: "Black Friday", date: blackFriday(year), category: "Data comercial" },
    { name: "Cyber Monday", date: offset(new Date(`${blackFriday(year)}T00:00:00Z`), 3), category: "Data comercial" },

    // ── Outras datas de pauta ──
    { name: "Dia Internacional da Mulher", date: fixed(year, 3, 8), category: "Data comemorativa", sensitive: true },
    { name: "Dia do Meio Ambiente", date: fixed(year, 6, 5), category: "Data comemorativa" },
    { name: "Festa Junina (São João)", date: fixed(year, 6, 24), category: "Data comemorativa" },
    { name: "Setembro Amarelo", date: fixed(year, 9, 10), category: "Data comemorativa", sensitive: true },
    { name: "Outubro Rosa", date: fixed(year, 10, 1), category: "Data comemorativa", sensitive: true },
    { name: "Novembro Azul", date: fixed(year, 11, 1), category: "Data comemorativa", sensitive: true },
    { name: "Halloween", date: fixed(year, 10, 31), category: "Data comemorativa" },
    { name: "Véspera de Natal", date: fixed(year, 12, 24), category: "Data comemorativa" },
    { name: "Réveillon", date: fixed(year, 12, 31), category: "Data comemorativa" },
  ];

  return entries
    .map((e) => ({
      // Stable id: the same date in the same year is always the same record,
      // so "already added" survives a reload without storing the catalogue.
      id: `cat:${e.date}:${slug(e.name)}`,
      date: e.date,
      name: e.name,
      category: e.category,
      color: COLOR[e.category],
      sensitive: e.sensitive,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The catalogue entries that fall inside a month (YYYY-MM). */
export function markedDatesInMonth(month: string): MarkedDate[] {
  const year = Number(month.slice(0, 4));
  if (!Number.isFinite(year)) return [];
  return markedDatesFor(year).filter((d) => d.date.startsWith(month));
}
