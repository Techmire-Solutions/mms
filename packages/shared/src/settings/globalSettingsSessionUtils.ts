import type { AppTranslationKey } from "../i18n/appTranslations.js";

/** Allowed session timeout values (minutes) in global settings UI. */
export const SESSION_TIMEOUT_VALUES = ["15", "30", "60", "120", "480"] as const;

export type SessionTimeoutValue = (typeof SESSION_TIMEOUT_VALUES)[number];

/** Session timeout presets for global settings UI (value + translation key). */
export const SESSION_TIMEOUT_PRESETS: readonly {
  value: SessionTimeoutValue;
  labelKey: AppTranslationKey;
}[] = [
  { value: "15", labelKey: "global.timeout15" },
  { value: "30", labelKey: "global.timeout30" },
  { value: "60", labelKey: "global.timeout60" },
  { value: "120", labelKey: "global.timeout120" },
  { value: "480", labelKey: "global.timeout480" },
] as const;

const SESSION_TIMEOUT_VALUES_SET = new Set<string>(SESSION_TIMEOUT_VALUES);

/** Coerces stored session timeout to a supported select value. */
export function normalizeSessionTimeout(value: string | number | undefined): SessionTimeoutValue {
  const raw = String(value ?? "60");
  return SESSION_TIMEOUT_VALUES_SET.has(raw) ? (raw as SessionTimeoutValue) : "60";
}

/** Parses session timeout minutes from global settings (clamped 1–480). */
export function parseSessionTimeoutMinutes(value: string | number | undefined): number {
  return parseInt(normalizeSessionTimeout(value), 10);
}
