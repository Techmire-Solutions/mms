import { getIntlLocaleForLanguage } from "./languageUtils.js";
import {
  type DateFormatId,
  type DateFormatOption,
  LOCALE_PROBE_DATE,
  PRESETS,
} from "./dateFormatPresets.js";
import { formatDateParts } from "./dateFormatParse.js";

const INTL_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getCachedIntlFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = INTL_FORMATTER_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    INTL_FORMATTER_CACHE.set(key, formatter);
  }
  return formatter;
}

/**
 * Infers the closest preset for a UI language using `Intl` regional conventions.
 */
export function detectLocaleDateFormat(language: string): DateFormatId {
  const locale = getIntlLocaleForLanguage(language);
  const parts = getCachedIntlFormatter(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(LOCALE_PROBE_DATE);

  const order = parts
    .filter((p) => p.type === "day" || p.type === "month" || p.type === "year")
    .map((p) => p.type);
  const separator = parts.find((p) => p.type === "literal" && /[/\-.]/.test(p.value))?.value ?? "/";

  if (order[0] === "year") {
    return separator === "-" ? "YYYY-MM-DD" : "YYYY/MM/DD";
  }
  if (order[0] === "month") {
    return "MM/DD/YYYY";
  }
  if (separator === ".") return "DD.MM.YYYY";
  if (separator === "-") return "DD-MM-YYYY";
  return "DD/MM/YYYY";
}

/**
 * Builds select options with a live sample for each preset.
 */
export function getDateFormatOptions(
  language: string,
  sample: Date = new Date(),
): readonly DateFormatOption[] {
  const locale = getIntlLocaleForLanguage(language);
  const intlParts = getCachedIntlFormatter(locale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(sample);
  const day = Number(intlParts.find((p) => p.type === "day")?.value ?? sample.getUTCDate());
  const month = Number(
    intlParts.find((p) => p.type === "month")?.value ?? sample.getUTCMonth() + 1,
  );
  const year = Number(intlParts.find((p) => p.type === "year")?.value ?? sample.getUTCFullYear());

  return PRESETS.map((preset) => ({
    value: preset.id,
    pattern: preset.id,
    sample: formatDateParts(day, month, year, preset.id),
    hintKey: preset.hintKey,
  }));
}
