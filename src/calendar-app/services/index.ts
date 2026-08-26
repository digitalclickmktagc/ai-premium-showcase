import type { DataService } from "./DataService";
import { LocalStorageService } from "./localStorageService";
import { SupabaseService } from "./supabaseService";

export type { DataService } from "./DataService";

/**
 * Selects the active data adapter.
 *
 * - Supabase (production): used when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
 *   are set. Real multi-device storage with server-enforced isolation (RLS).
 * - localStorage (demo): the fallback — works offline, single-device.
 */
let singleton: DataService | null = null;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export function getDataService(): DataService {
  if (singleton) return singleton;
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    singleton = new SupabaseService(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    singleton = new LocalStorageService();
  }
  return singleton;
}

/** True when the app is backed by Supabase (vs. the localStorage demo). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
