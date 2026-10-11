import { reportClientWarn } from "@/lib/clientErrorReporting";

interface RawColumnPreferenceEntry {
  key: string;
  enabled?: unknown;
  order?: unknown;
  width?: unknown;
  [key: string]: unknown;
}

interface SanitizedColumnPreferenceEntry {
  key: string;
  enabled: boolean;
  order: number;
  width?: number;
}

function isColumnPreferenceEntry(value: unknown): value is RawColumnPreferenceEntry {
  if (typeof value !== "object" || value === null) return false;
  const key = (value as Record<string, unknown>).key;
  return typeof key === "string" && key.trim().length > 0;
}

function coerceEnabled(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  return raw === "true" || raw === 1 || raw === "1";
}

function coerceOrder(raw: unknown, fallback: number): number {
  const num = typeof raw === "number" ? raw : parseFloat(String(raw));
  const floored = Math.floor(num);
  return Number.isSafeInteger(floored) && floored >= 0 ? floored : fallback;
}

function coerceWidth(raw: unknown): number | undefined {
  return typeof raw === "number" && raw > 0 ? Math.round(raw) : undefined;
}

function sanitizeColumnPreferences(rawPrefs: unknown[]): SanitizedColumnPreferenceEntry[] {
  return rawPrefs
    .filter(isColumnPreferenceEntry)
    .map((pref, index): SanitizedColumnPreferenceEntry => {
      const width = coerceWidth(pref.width);
      return {
        key: pref.key.trim(),
        enabled: coerceEnabled(pref.enabled),
        order: coerceOrder(pref.order, index),
        ...(width !== undefined ? { width } : {}),
      };
    });
}

export function sanitizeColumnPreferencesBody(path: string, init: RequestInit): RequestInit {
  if (
    !(path.includes("column-preferences") || path.includes("column-prefs")) ||
    !init.body ||
    typeof init.body !== "string"
  ) {
    return init;
  }

  try {
    const parsed = JSON.parse(init.body) as Record<string, unknown>;
    const rawPreferences = Array.isArray(parsed.preferences)
      ? parsed.preferences
      : Array.isArray(parsed.prefs)
        ? parsed.prefs
        : null;

    if (!rawPreferences) return init;

    const sanitized = sanitizeColumnPreferences(rawPreferences);

    const updated = {
      ...parsed,
      ...(Array.isArray(parsed.preferences) ? { preferences: sanitized } : { prefs: sanitized }),
    };

    return { ...init, body: JSON.stringify(updated) };
  } catch (parseError) {
    reportClientWarn(parseError, { context: "api.sanitizeColumnPreferences" });
    return init;
  }
}
