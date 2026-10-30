import type { Formatters, Labels } from "react-day-picker";
import { getIntlLocaleForLanguage } from "@mms/shared";

type Translate = (key: string) => string;

export interface CalendarLocale {
  intlLocale: string;
  formatters: Partial<Formatters>;
  labels: Partial<Labels>;
}

/**
 * The grid stores and displays Gregorian dates (`YYYY-MM-DD` strings), while
 * `Intl` would default `ar-SA` to the Umm al-Qura calendar and `fa-IR` to the
 * Jalali calendar. Month/year names must therefore be requested explicitly as
 * Gregorian; otherwise the caption would describe a different month than the
 * cells below it.
 */
const GREGORIAN: Intl.DateTimeFormatOptions = { calendar: "gregory" };

/**
 * Locale-aware formatters and ARIA labels for `react-day-picker`.
 *
 * `react-day-picker` defaults to `date-fns`' `enUS`, so without this the calendar
 * shows English month/weekday names, English day numerals and English screen-reader
 * labels inside ar/ur/fa pages.
 */
export function buildCalendarLocale(language: string, t: Translate): CalendarLocale {
  const intlLocale = getIntlLocaleForLanguage(language);
  const monthLong = new Intl.DateTimeFormat(intlLocale, { ...GREGORIAN, month: "long" });
  const monthYear = new Intl.DateTimeFormat(intlLocale, {
    ...GREGORIAN,
    month: "long",
    year: "numeric",
  });
  const weekdayShort = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });
  const weekdayLong = new Intl.DateTimeFormat(intlLocale, { weekday: "long" });
  const fullDate = new Intl.DateTimeFormat(intlLocale, { ...GREGORIAN, dateStyle: "full" });
  const dayNumber = new Intl.NumberFormat(intlLocale, { useGrouping: false });
  const yearNumber = new Intl.NumberFormat(intlLocale, { useGrouping: false });

  return {
    intlLocale,
    formatters: {
      formatCaption: (date) => monthYear.format(date),
      formatMonthDropdown: (month) => monthLong.format(month),
      formatYearDropdown: (year) => yearNumber.format(year.getFullYear()),
      formatWeekdayName: (weekday) => weekdayShort.format(weekday),
      formatDay: (date) => dayNumber.format(date.getDate()),
    },
    labels: {
      labelMonthDropdown: () => t("datePicker.selectMonth"),
      labelYearDropdown: () => t("datePicker.selectYear"),
      labelPrevious: () => t("datePicker.previousMonth"),
      labelNext: () => t("datePicker.nextMonth"),
      labelWeekday: (weekday) => weekdayLong.format(weekday),
      labelDayButton: (date) => fullDate.format(date),
      labelGrid: (date) => monthYear.format(date),
    },
  };
}
