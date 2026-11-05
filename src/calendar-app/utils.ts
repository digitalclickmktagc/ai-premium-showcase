import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Cryptographically-random id, falling back to Math.random when needed. */
export function uid(prefix = ""): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

/**
 * Generate an unguessable share token (URL-safe). Long enough that it can't be
 * enumerated, which is the sole access control for the client share link.
 */
export function shareToken(): string {
  const bytes = new Uint8Array(18);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let base64 = "";
  if (typeof btoa !== "undefined") {
    base64 = btoa(String.fromCharCode(...bytes));
  } else {
    base64 = Buffer.from(bytes).toString("base64");
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Today as a `YYYY-MM-DD` string in local time. */
export function todayISO(): string {
  return toDayISO(new Date());
}

/** Convert a Date to a local `YYYY-MM-DD` day string (no timezone shift). */
export function toDayISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` day string into a local Date at midnight. */
export function fromDayISO(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Format a `YYYY-MM-DD` day for display, e.g. "07 de junho de 2026". */
export function formatLongDay(day: string): string {
  try {
    return format(fromDayISO(day), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return day;
  }
}

/** Short day + weekday, e.g. "qui, 07/06". */
export function formatShortDay(day: string): string {
  try {
    return format(fromDayISO(day), "EEE, dd/MM", { locale: ptBR });
  } catch {
    return day;
  }
}

/** Format an ISO timestamp for display, e.g. "07/06/2026 14:30". */
export function formatTimestamp(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

/** Capitalized month + year title, e.g. "Junho 2026". */
export function formatMonthTitle(date: Date): string {
  const raw = format(date, "MMMM yyyy", { locale: ptBR });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** A pleasant default palette for new clients. */
export const CLIENT_COLORS = [
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#22c55e", // green
  "#eab308", // yellow
  "#ef4444", // red
  "#3b82f6", // blue
  "#14b8a6", // teal
  "#a855f7", // purple
];

export function randomClientColor(): string {
  return CLIENT_COLORS[Math.floor(Math.random() * CLIENT_COLORS.length)];
}

/** Initials for an avatar fallback. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

/** Build the absolute client share URL for a token. */
export function shareUrl(token: string): string {
  if (typeof window === "undefined") return `/c/${token}`;
  return `${window.location.origin}/c/${token}`;
}

/** URL schemes that are safe to put in an href we render for third parties. */
const SAFE_LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * Validate a user-supplied reference link before rendering it as an anchor.
 *
 * The client portal shows this link to third parties, so a `javascript:` or
 * `data:` value would run script in the client's browser. Returns the
 * normalized URL when the scheme is safe, otherwise null so the caller can
 * render it as inert text.
 */
export function safeExternalUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // Bare host like "drive.google.com/x" — assume https rather than reject.
    try {
      url = new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
  return SAFE_LINK_SCHEMES.has(url.protocol) ? url.href : null;
}
