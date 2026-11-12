import {
  createDateNumberFormatter,
  GREGORIAN_CALENDAR,
  parseDatePart,
} from "./settingsDateDigits.js";
import { formatDateParts, formatDatePartsWithMonthName } from "../core/dateFormatUtils.js";
import { getIntlLocaleForLanguage } from "../core/languageUtils.js";
import { getStoredGlobalSettings } from "./settingsDateProvider.js";
import { formatDateOnly } from "./settingsDateOnlyFormat.js";

/** Formats a date according to the active global format. */
export function formatDate(
  date: string | Date | number | null | undefined,
  dateFormatOrShowMonthName?: string | boolean,
  showMonthName = false,
): string {
  if (!date) return "—";

  const stored = getStoredGlobalSettings();
  let actualDateFormat = stored.dateFormat;
  let actualShowMonthName = showMonthName;
  const timezone = stored.timezone;
  const language = stored.language;

  if (typeof dateFormatOrShowMonthName === "boolean") {
    actualShowMonthName = dateFormatOrShowMonthName;
  } else if (typeof dateFormatOrShowMonthName === "string") {
    actualDateFormat = dateFormatOrShowMonthName;
  }

  const intlLocale = getIntlLocaleForLanguage(language);
  const formatNumberPart = createDateNumberFormatter(intlLocale);

  const dateOnly =
    typeof date === "string"
      ? formatDateOnly(date, {
          dateFormat: actualDateFormat,
          showMonthName: actualShowMonthName,
          intlLocale,
        })
      : null;
  if (dateOnly !== null) return dateOnly;

  const parsedDate = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(parsedDate.getTime())) return "—";

  const parts = new Intl.DateTimeFormat(intlLocale, {
    calendar: GREGORIAN_CALENDAR,
    timeZone: timezone,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(parsedDate);
  const dayNum = parseDatePart(
    parts.find((part) => part.type === "day")?.value,
    parsedDate.getDate(),
  );
  const monthNum = parseDatePart(
    parts.find((part) => part.type === "month")?.value,
    parsedDate.getMonth() + 1,
  );
  const yearNum = parseDatePart(
    parts.find((part) => part.type === "year")?.value,
    parsedDate.getFullYear(),
  );

  if (actualShowMonthName) {
    const month =
      new Intl.DateTimeFormat(intlLocale, {
        calendar: GREGORIAN_CALENDAR,
        timeZone: timezone,
        month: "short",
      })
        .formatToParts(parsedDate)
        .find((part) => part.type === "month")?.value ?? String(monthNum);
    return formatDatePartsWithMonthName(
      dayNum,
      month,
      monthNum,
      yearNum,
      actualDateFormat,
      formatNumberPart,
    );
  }

  return formatDateParts(dayNum, monthNum, yearNum, actualDateFormat, formatNumberPart);
}
