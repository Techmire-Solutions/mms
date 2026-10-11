import { APP_TRANSLATIONS_EN } from "./appTranslationsEn.js";
import { normalizeAppLanguage, getIntlLocaleForLanguage } from "./languageUtils.js";
import { normalizeModuleTierTabId } from "./moduleTierTabs.js";

export { APP_TRANSLATIONS_EN };

/** App-wide UI string keys (navigation, settings shell, auth, module tiers). */
export type AppTranslationKey = keyof typeof APP_TRANSLATIONS_EN;

/** Dynamic sub-blocks to ignore in ICU plural selects. */
export type ExcludedPlaceholders =
  | "records"
  | "months"
  | "reminders"
  | "students"
  | "cards"
  | "Months"
  | "count, select, one {record"
  | "count, select, one {month"
  | "count, select, one {reminder"
  | "count, select, one {student"
  | "count, select, one {card"
  | "elements selected"
  | "count, select, one {element selected"
  | "count, select, one {Month";

/** Extracts all dynamic placeholder names (wrapped in curly braces) from a string literal type. */
export type ExtractPlaceholders<S extends string> = S extends `${string}{${infer P}}${infer R}`
  ? (P extends ExcludedPlaceholders ? never : P) | ExtractPlaceholders<R>
  : never;

/** Strict parameter arguments map based on translation key. */
export type TranslationArgs<K extends AppTranslationKey> = [AppTranslationKey] extends [K]
  ? [params?: Record<string, string | number>]
  : ExtractPlaceholders<(typeof APP_TRANSLATIONS_EN)[K]> extends never
    ? [params?: never]
    : [params: Record<ExtractPlaceholders<(typeof APP_TRANSLATIONS_EN)[K]>, string | number>];

// Global runtime cache for loaded translation packs.
// English is statically loaded by default.
const TRANSLATION_CACHE: Record<string, Record<string, string>> = {
  en: APP_TRANSLATIONS_EN,
};

/** Registers an asynchronously-loaded language translation dictionary pack. */
export function registerLanguagePack(lang: string, dict: Record<string, string>): void {
  TRANSLATION_CACHE[lang] = dict;
}

/** Resolves an app-wide UI string for the active language (falls back to English). */
export function translateApp(key: AppTranslationKey, language: string): string {
  const lang = normalizeAppLanguage(language);
  const dict = TRANSLATION_CACHE[lang] || TRANSLATION_CACHE.en;
  if (dict[key] !== undefined) {
    return dict[key];
  }
  if (lang === "fa" && TRANSLATION_CACHE.ar?.[key] !== undefined) {
    return TRANSLATION_CACHE.ar[key];
  }
  return TRANSLATION_CACHE.en[key] ?? key;
}

const ICU_SELECT_REGEX = /\{(\w+),\s*select,\s*one\s*\{([^}]+)\}\s*other\s*\{([^}]+)\}\}/g;

/** Like `translateApp` with `{param}` placeholder substitution (strictly type-safe). */
export function translateAppParams<K extends AppTranslationKey>(
  key: K,
  language: string,
  ...args: TranslationArgs<K>
): string {
  const params = args[0] as Record<string, string | number> | undefined;
  let text = translateApp(key, language);
  if (!params) return text;

  // Format simple ICU plural select formatting: {count, select, one {record} other {records}}
  text = text.replace(ICU_SELECT_REGEX, (_match, varName, singular, plural) => {
    const val = Number(params[varName]);
    return val === 1 ? singular : plural;
  });

  for (const [name, value] of Object.entries(params)) {
    let formattedValue = String(value);
    if (typeof value === "number") {
      const lowerName = name.toLowerCase();
      if (!lowerName.endsWith("id") && !lowerName.endsWith("code") && !lowerName.endsWith("year")) {
        const locale = getIntlLocaleForLanguage(language);
        formattedValue = new Intl.NumberFormat(locale).format(value);
      }
    }
    text = text.replaceAll(`{${name}}`, formattedValue);
  }
  return text;
}

const MODULE_NAV_KEYS: Partial<Record<string, AppTranslationKey>> = {
  dashboard: "nav.dashboard",
  contacts: "nav.contacts",
  messaging: "nav.messaging",
  students: "nav.students",
  faculty: "nav.faculty",
  sessions: "nav.sessions",
  attendance: "nav.attendance",
  enrollment: "nav.enrollments",
  hasanat: "nav.hasanatCards",
  examination: "nav.examinations",
  questionBank: "nav.questionBank",
  finance: "nav.finance",
  accounting: "nav.accounting",
  users: "nav.users",
};

const MODULE_DESC_KEYS: Partial<Record<string, AppTranslationKey>> = {
  dashboard: "module.desc.dashboard",
  contacts: "module.desc.contacts",
  messaging: "module.desc.messaging",
  students: "module.desc.students",
  faculty: "module.desc.faculty",
  sessions: "module.desc.sessions",
  attendance: "module.desc.attendance",
  enrollment: "module.desc.enrollment",
  hasanat: "module.desc.hasanat",
  examination: "module.desc.examination",
  questionBank: "module.desc.questionBank",
  finance: "module.desc.finance",
  accounting: "module.desc.accounting",
  users: "module.desc.users",
};

/** Localized system-module label from module id. */
export function translateSystemModuleLabel(
  moduleId: string,
  language: string,
  fallback: string,
): string {
  const key = MODULE_NAV_KEYS[moduleId];
  return key ? translateApp(key, language) : fallback;
}

/** Localized system-module description from module id. */
export function translateSystemModuleDescription(
  moduleId: string,
  language: string,
  fallback: string,
): string {
  const key = MODULE_DESC_KEYS[moduleId];
  return key ? translateApp(key, language) : fallback;
}

const MODULE_TAB_KEYS: Record<string, AppTranslationKey> = {
  work: "module.work",
  reports: "module.reports",
  setup: "module.setup",
  fields: "module.fields",
  preferences: "module.preferences",
};

/** Maps standard module tab ids to localized labels. */
export function translateModuleTabLabel(tabId: string, fallback: string, language: string): string {
  const key = MODULE_TAB_KEYS[normalizeModuleTierTabId(tabId)];
  return key ? translateApp(key, language) : fallback;
}
