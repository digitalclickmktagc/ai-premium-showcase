/**
 * Feature flags.
 *
 * A flag lets a feature ship fully built but switched off, so it can be
 * reviewed in the test environment and turned on later without a code change
 * beyond the env var.
 *
 * Set `VITE_FEATURE_CLIENT_HUB=true` to enable the client hub.
 */
function readFlag(raw: unknown, fallback = false): boolean {
  if (typeof raw !== "string") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "") return fallback;
  return v === "true" || v === "1" || v === "on" || v === "yes";
}

export const FEATURES = {
  /**
   * Client hub (Spec 05): portal logins, roles, areas, messages.
   *
   * OFF by default, as decided. The read-only share link at /c/:token and the
   * approval flow are NOT part of this flag — those are already live.
   */
  clientHub: readFlag(import.meta.env.VITE_FEATURE_CLIENT_HUB, false),
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isEnabled(feature: FeatureName): boolean {
  return FEATURES[feature];
}
