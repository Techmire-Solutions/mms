import type { AppTranslationKey } from "./appTranslations.js";

const SESSION_TYPE_LABEL_KEYS: Record<string, AppTranslationKey> = {
  Hifz: "sessions.types.hifz",
  Qaidah: "sessions.types.qaidah",
  Tajweed: "sessions.types.tajweed",
  "Islamic Studies": "sessions.types.islamicStudies",
  Arabic: "sessions.types.arabic",
  Other: "sessions.types.other",
};

/**
 * i18n key for a session type — SSOT for the Hifz/Qaidah/Tajweed label map.
 * Returns `null` for unregistered (custom) types so callers pick a
 * non-English fallback instead of rendering the raw value.
 */
export function sessionTypeI18nKey(
  sessionType: string | null | undefined,
): AppTranslationKey | null {
  return sessionType ? (SESSION_TYPE_LABEL_KEYS[sessionType] ?? null) : null;
}
