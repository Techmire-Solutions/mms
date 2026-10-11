/** Supported application UI language codes. */
export type AppLanguageCode = "en" | "ar" | "ur" | "fa";

export interface AppLanguageOption {
  code: AppLanguageCode;
  label: string;
  nativeLabel: string;
  direction: "ltr" | "rtl";
}

/** Authoritative list of UI languages (order = select display order). */
export const APP_LANGUAGES: readonly AppLanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", direction: "ltr" },
  { code: "ar", label: "Arabic", nativeLabel: "عربي", direction: "rtl" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو", direction: "rtl" },
  { code: "fa", label: "Persian", nativeLabel: "فارسی", direction: "rtl" },
] as const;

const LANGUAGE_BY_CODE = new Map(
  APP_LANGUAGES.map((lang) => [lang.code, lang] as const)
);

/**
 * Resolves question-form UI language: when the selected question language differs from
 * system UI language, the form labels switch to the question language.
 */
export function resolveQuestionFormLanguage(
  systemLanguage: string,
  questionLanguage: string | undefined | null,
  questionLanguageFieldEnabled: boolean,
): AppLanguageCode {
  const system = normalizeAppLanguage(systemLanguage);
  if (!questionLanguageFieldEnabled) return system;
  const trimmed = questionLanguage?.trim();
  if (!trimmed || !LANGUAGE_BY_CODE.has(trimmed as AppLanguageCode)) {
    return system;
  }
  const selected = trimmed as AppLanguageCode;
  return selected !== system ? selected : system;
}

/**
 * Coerces an arbitrary stored value to a supported language code (defaults to English).
 */
export function normalizeAppLanguage(code: string | undefined | null): AppLanguageCode {
  if (code && LANGUAGE_BY_CODE.has(code as AppLanguageCode)) {
    return code as AppLanguageCode;
  }
  return "en";
}

/** Text direction for the given language code. */
export function getLanguageDirection(code: string): "ltr" | "rtl" {
  return LANGUAGE_BY_CODE.get(normalizeAppLanguage(code))?.direction ?? "ltr";
}

/** Whether the language uses right-to-left layout. */
export function isRtlLanguage(code: string): boolean {
  return getLanguageDirection(code) === "rtl";
}

/** BCP 47 locale tag used for `Intl` formatting (dates, numbers). */
export function getIntlLocaleForLanguage(code: string): string {
  switch (normalizeAppLanguage(code)) {
    case "ar":
      return "ar-SA";
    case "ur":
      return "ur-PK";
    case "fa":
      return "fa-IR";
    default:
      return "en-GB";
  }
}

/** Human-readable label for language `<select>` options. */
export function formatLanguageSelectLabel(lang: AppLanguageOption): string {
  if (lang.code === "en") return lang.label;
  return `${lang.label} (${lang.nativeLabel})`;
}

/** Font stacks per language for readable RTL scripts. */
export function getLanguageFontStacks(code: string): { sans: string; display: string } {
  switch (normalizeAppLanguage(code)) {
    case "ur":
      return {
        sans: "'Noto Nastaliq Urdu', 'Amiri', serif",
        display: "'Noto Nastaliq Urdu', 'Amiri', serif",
      };
    case "ar":
      return {
        sans: "'Noto Sans Arabic', 'Inter', sans-serif",
        display: "'Amiri', serif",
      };
    case "fa":
      return {
        sans: "'Vazirmatn', 'Inter', sans-serif",
        display: "'Vazirmatn', sans-serif",
      };
    default:
      return {
        sans: "'Inter', sans-serif",
        display: "'Amiri', serif",
      };
  }
}

