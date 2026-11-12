import { formatDateParts, formatDatePartsWithMonthName } from "../core/dateFormatUtils.js";
import { createDateNumberFormatter, GREGORIAN_CALENDAR } from "./settingsDateDigits.js";

const DATE_ONLY_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats a storage `YYYY-MM-DD` as a calendar fact, not an instant.
 *
 * Parsing date-only strings with `new Date()` treats them as UTC midnight; formatting that instant
 * in a negative-offset workspace timezone prints the previous day. This helper returns `null` when
 * the value is not date-only, so the caller keeps the normal timezone-aware path for ISO datetimes.
 */
export function formatDateOnly(
  date: string,
  options: { dateFormat: string; showMonthName: boolean; intlLocale: string },
): string | null {
  const match = DATE_ONLY_SHAPE.exec(date.trim());
  if (!match) return null;
  const yearNum = Number(match[1]);
  const monthNum = Number(match[2]);
  const dayNum = Number(match[3]);
  const formatNumberPart = createDateNumberFormatter(options.intlLocale);

  if (options.showMonthName) {
    const month =
      new Intl.DateTimeFormat(options.intlLocale, {
        calendar: GREGORIAN_CALENDAR,
        timeZone: "UTC",
        month: "short",
      })
        .formatToParts(new Date(Date.UTC(yearNum, monthNum - 1, 1)))
        .find((part) => part.type === "month")?.value ?? String(monthNum);
    return formatDatePartsWithMonthName(
      dayNum,
      month,
      monthNum,
      yearNum,
      options.dateFormat,
      formatNumberPart,
    );
  }
  return formatDateParts(dayNum, monthNum, yearNum, options.dateFormat, formatNumberPart);
}
