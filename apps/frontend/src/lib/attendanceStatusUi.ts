import type { AppTranslationKey } from "@mms/shared";

type Translate = (key: AppTranslationKey) => string;

/** Localized attendance status label with config-label fallback. */
export function attendanceStatusLabel(status: { id: string; label: string }, t: Translate): string {
  const key = `attendance.status.${status.id}` as AppTranslationKey;
  const translated = t(key);
  return translated === key ? status.label : translated;
}
