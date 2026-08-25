import type { DataService } from "./DataService";
import { LocalStorageService } from "./localStorageService";

export type { DataService } from "./DataService";

/**
 * Selects the active data adapter.
 *
 * Default: localStorage (works offline, single-device — great for demo and for
 * a solo operator). To move to real multi-device sharing with server-enforced
 * isolation, implement a Supabase adapter (see supabase/schema.sql and
 * src/calendar-app/services/supabaseService.ts.example) and return it here when
 * `import.meta.env.VITE_SUPABASE_URL` is present.
 */
let singleton: DataService | null = null;

export function getDataService(): DataService {
  if (singleton) return singleton;
  // Placeholder for the production switch:
  // if (import.meta.env.VITE_SUPABASE_URL) {
  //   singleton = new SupabaseService();
  //   return singleton;
  // }
  singleton = new LocalStorageService();
  return singleton;
}
