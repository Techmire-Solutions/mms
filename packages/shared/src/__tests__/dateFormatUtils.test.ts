import { describe, expect, it } from "vitest";
import {
  normalizeDateFormat,
  formatDateParts,
  formatMonthYearParts,
  formatDatePartsWithMonthName,
  formatDateInputAsYouType,
  formatIsoDateToDisplay,
  formatIsoDateToDisplayWithMonthName,
  parseDisplayDateToIso,
  detectLocaleDateFormat,
  getDateFormatOptions,
  getDateFormatPresets,
  formatDateToIso,
  todayISO,
  parseIsoDate,
  parseFlexibleIsoDate,
  parseIsoYear,
  parseYearValue,
  isYearWithinBounds,
  resolveYearPickerBounds,
  isDateWithinIsoBounds,
  resolveDatePickerMonthBounds,
  parseTimeHHmm,
  formatTimeHHmm,
  normalizeTimeHHmm,
  splitIsoDateTime,
  combineIsoDateAndTime,
  DATE_FORMAT_PRESET_IDS,
  DATE_PICKER_YEAR_PAST,
  DATE_PICKER_YEAR_FUTURE,
} from "../core/dateFormatUtils.js";

describe("dateFormatUtils", () => {
  describe("normalizeDateFormat", () => {
    it("returns default fallback DD/MM/YYYY for undefined or unknown input", () => {
      expect(normalizeDateFormat(undefined)).toBe("DD/MM/YYYY");
      expect(normalizeDateFormat(null)).toBe("DD/MM/YYYY");
      expect(normalizeDateFormat("INVALID_FORMAT")).toBe("DD/MM/YYYY");
      expect(normalizeDateFormat("INVALID_FORMAT", "MM/DD/YYYY")).toBe("MM/DD/YYYY");
      expect(normalizeDateFormat(null, "YYYY-MM-DD")).toBe("YYYY-MM-DD");
    });

    it("preserves valid preset IDs", () => {
      for (const preset of DATE_FORMAT_PRESET_IDS) {
        expect(normalizeDateFormat(preset)).toBe(preset);
      }
    });
  });

  describe("formatDateParts", () => {
    it("formats parts correctly per preset", () => {
      expect(formatDateParts(5, 3, 2026, "DD/MM/YYYY")).toBe("05/03/2026");
      expect(formatDateParts(5, 3, 2026, "MM/DD/YYYY")).toBe("03/05/2026");
      expect(formatDateParts(5, 3, 2026, "YYYY-MM-DD")).toBe("2026-03-05");
      expect(formatDateParts(5, 3, 2026, "DD-MM-YYYY")).toBe("05-03-2026");
      expect(formatDateParts(5, 3, 2026, "DD.MM.YYYY")).toBe("05.03.2026");
      expect(formatDateParts(5, 3, 2026, "YYYY/MM/DD")).toBe("2026/03/05");
    });
  });

  describe("formatDatePartsWithMonthName", () => {
    it("formats with month names correctly", () => {
      expect(formatDatePartsWithMonthName(15, "Mar", 3, 2026, "MM/DD/YYYY")).toBe("Mar 15, 2026");
      expect(formatDatePartsWithMonthName(15, "Mar", 3, 2026, "DD/MM/YYYY")).toBe("15 Mar 2026");
      expect(formatDatePartsWithMonthName(15, "Mar", 3, 2026, "YYYY-MM-DD")).toBe("2026-03-15");
      expect(formatDatePartsWithMonthName(15, "Mar", 3, 2026, "YYYY/MM/DD")).toBe("2026-03-15");
      expect(formatDatePartsWithMonthName(15, "Mar", 3, 2026, "DD-MM-YYYY")).toBe("15 Mar 2026");
    });
  });

  describe("formatMonthYearParts", () => {
    it("formats month and year correctly per preset", () => {
      expect(formatMonthYearParts(5, 2024, "DD/MM/YYYY")).toBe("05/2024");
      expect(formatMonthYearParts(5, 2024, "MM/DD/YYYY")).toBe("05/2024");
      expect(formatMonthYearParts(5, 2024, "YYYY-MM-DD")).toBe("2024-05");
      expect(formatMonthYearParts(5, 2024, "YYYY/MM/DD")).toBe("2024/05");
      expect(formatMonthYearParts(5, 2024, "DD-MM-YYYY")).toBe("05-2024");
      expect(formatMonthYearParts(5, 2024, "DD.MM.YYYY")).toBe("05.2024");
    });
  });

  describe("formatIsoDateToDisplay and parseDisplayDateToIso", () => {
    it("converts full ISO dates to display format and parses back accurately", () => {
      const iso = "2026-07-21";

      const displayUK = formatIsoDateToDisplay(iso, "DD/MM/YYYY");
      expect(displayUK).toBe("21/07/2026");
      expect(parseDisplayDateToIso(displayUK, "DD/MM/YYYY")).toBe("2026-07-21");

      const displayUS = formatIsoDateToDisplay(iso, "MM/DD/YYYY");
      expect(displayUS).toBe("07/21/2026");
      expect(parseDisplayDateToIso(displayUS, "MM/DD/YYYY")).toBe("2026-07-21");
    });

    it("formats and parses Year-only dates (YYYY)", () => {
      expect(formatIsoDateToDisplay("2024", "DD/MM/YYYY")).toBe("2024");
      expect(formatIsoDateToDisplay("2024", "YYYY-MM-DD")).toBe("2024");
      expect(parseDisplayDateToIso("2024", "DD/MM/YYYY")).toBe("2024");
      expect(parseDisplayDateToIso("  1998  ", "DD/MM/YYYY")).toBe("1998");
      expect(parseDisplayDateToIso("2024", "YYYY-MM-DD")).toBe("2024");
    });

    it("formats and parses Month-and-Year dates (YYYY-MM)", () => {
      expect(formatIsoDateToDisplay("2024-05", "DD/MM/YYYY")).toBe("05/2024");
      expect(formatIsoDateToDisplay("2024-05", "YYYY-MM-DD")).toBe("2024-05");
      expect(formatIsoDateToDisplay("2024-05", "DD-MM-YYYY")).toBe("05-2024");

      expect(parseDisplayDateToIso("05/2024", "DD/MM/YYYY")).toBe("2024-05");
      expect(parseDisplayDateToIso("5/2024", "DD/MM/YYYY")).toBe("2024-05");
      expect(parseDisplayDateToIso("05-2024", "DD/MM/YYYY")).toBe("2024-05");
      expect(parseDisplayDateToIso("05.2024", "DD.MM.YYYY")).toBe("2024-05");
      expect(parseDisplayDateToIso("2024-05", "YYYY-MM-DD")).toBe("2024-05");
      expect(parseDisplayDateToIso("2024/05", "YYYY-MM-DD")).toBe("2024-05");
      expect(parseDisplayDateToIso("052024", "DD/MM/YYYY")).toBe("2024-05");
      expect(parseDisplayDateToIso("202405", "YYYY-MM-DD")).toBe("2024-05");
    });

    it("parses flexible ISO dates via parseFlexibleIsoDate", () => {
      const yearOnly = parseFlexibleIsoDate("2024");
      expect(yearOnly?.getFullYear()).toBe(2024);
      expect(yearOnly?.getMonth()).toBe(0);

      const monthYear = parseFlexibleIsoDate("2024-05");
      expect(monthYear?.getFullYear()).toBe(2024);
      expect(monthYear?.getMonth()).toBe(4);

      const fullDate = parseFlexibleIsoDate("2024-05-21");
      expect(fullDate?.getFullYear()).toBe(2024);
      expect(fullDate?.getMonth()).toBe(4);
      expect(fullDate?.getDate()).toBe(21);

      expect(parseFlexibleIsoDate(null)).toBeUndefined();
      expect(parseFlexibleIsoDate("")).toBeUndefined();
    });

    it("formats ISO dates with custom month names accurately", () => {
      expect(formatIsoDateToDisplayWithMonthName("2026-07-21", "DD/MM/YYYY", "Jul")).toBe(
        "21 Jul 2026",
      );
      expect(formatIsoDateToDisplayWithMonthName("2026-07-21", "MM/DD/YYYY", "Jul")).toBe(
        "Jul 21, 2026",
      );
      expect(formatIsoDateToDisplayWithMonthName("2026-07-21", "YYYY-MM-DD", "Jul")).toBe(
        "2026-07-21",
      );
      expect(formatIsoDateToDisplayWithMonthName(null, "DD/MM/YYYY", "Jul")).toBe("");
      expect(formatIsoDateToDisplayWithMonthName("", "DD/MM/YYYY", "Jul")).toBe("");
    });

    it("parses cross-separator formats flexibly", () => {
      expect(parseDisplayDateToIso("21.07.2026", "DD/MM/YYYY")).toBe("2026-07-21");
      expect(parseDisplayDateToIso("21-07-2026", "DD/MM/YYYY")).toBe("2026-07-21");
      expect(parseDisplayDateToIso("2026/07/21", "YYYY-MM-DD")).toBe("2026-07-21");
      expect(parseDisplayDateToIso("2026.07.21", "YYYY-MM-DD")).toBe("2026-07-21");
    });

    it("parses compact 8-digit strings without separators", () => {
      expect(parseDisplayDateToIso("21072026", "DD/MM/YYYY")).toBe("2026-07-21");
      expect(parseDisplayDateToIso("07212026", "MM/DD/YYYY")).toBe("2026-07-21");
      expect(parseDisplayDateToIso("20260721", "YYYY-MM-DD")).toBe("2026-07-21");
      expect(parseDisplayDateToIso("20260721", "YYYY/MM/DD")).toBe("2026-07-21");
    });

    it("parses full ISO datetimes and null/undefined values safely", () => {
      const parsedWithTime = parseIsoDate("2026-07-21T14:30:00.000Z");
      expect(parsedWithTime).toBeDefined();
      expect(parsedWithTime?.getFullYear()).toBe(2026);
      expect(parsedWithTime?.getMonth()).toBe(6);
      expect(parsedWithTime?.getDate()).toBe(21);

      expect(parseIsoDate(null)).toBeUndefined();
      expect(parseIsoDate(undefined)).toBeUndefined();
      expect(parseIsoDate("")).toBeUndefined();

      // Strict rejection of impossible calendar dates
      expect(parseIsoDate("2026-02-30")).toBeUndefined();
      expect(parseIsoDate("2026-04-31")).toBeUndefined();
      expect(parseIsoDate("2026-13-01")).toBeUndefined();

      expect(formatIsoDateToDisplay("2026-07-21T14:30:00.000Z", "DD/MM/YYYY")).toBe("21/07/2026");
      expect(formatIsoDateToDisplay(null, "DD/MM/YYYY")).toBe("");
      expect(normalizeDateFormat(null)).toBe("DD/MM/YYYY");
    });

    it("pivots 2-digit years accurately (sliding window >50 is 1900s, <=50 is 2000s)", () => {
      expect(parseDisplayDateToIso("21/07/95", "DD/MM/YYYY")).toBe("1995-07-21");
      expect(parseDisplayDateToIso("21/07/24", "DD/MM/YYYY")).toBe("2024-07-21");
      expect(parseDisplayDateToIso("210795", "DD/MM/YYYY")).toBe("1995-07-21");
      expect(parseDisplayDateToIso("210724", "DD/MM/YYYY")).toBe("2024-07-21");
    });

    it("strictly validates calendar leap years and rejects impossible month/day combinations", () => {
      // Leap year 2024 vs non-leap 2025
      expect(parseDisplayDateToIso("29/02/2024", "DD/MM/YYYY")).toBe("2024-02-29");
      expect(parseDisplayDateToIso("29/02/2025", "DD/MM/YYYY")).toBe("");

      // Month overflow
      expect(parseDisplayDateToIso("31/04/2026", "DD/MM/YYYY")).toBe("");
      expect(parseDisplayDateToIso("30/02/2026", "DD/MM/YYYY")).toBe("");

      // Invalid month bounds
      expect(parseDisplayDateToIso("15/13/2026", "DD/MM/YYYY")).toBe("");
      expect(parseDisplayDateToIso("15/00/2026", "DD/MM/YYYY")).toBe("");
    });

    it("handles empty or malformed strings gracefully", () => {
      expect(formatIsoDateToDisplay("", "DD/MM/YYYY")).toBe("");
      expect(formatIsoDateToDisplay("invalid", "DD/MM/YYYY")).toBe("invalid");
      expect(parseDisplayDateToIso("  ", "DD/MM/YYYY")).toBe("");
      expect(parseDisplayDateToIso("not-a-date", "DD/MM/YYYY")).toBe("");
    });
  });

  describe("formatDateInputAsYouType", () => {
    it("auto-inserts / between numbers for DD/MM/YYYY as user types digits", () => {
      expect(formatDateInputAsYouType("2", "DD/MM/YYYY", "")).toBe("2");
      expect(formatDateInputAsYouType("21", "DD/MM/YYYY", "2")).toBe("21/");
      expect(formatDateInputAsYouType("21/0", "DD/MM/YYYY", "21/")).toBe("21/0");
      expect(formatDateInputAsYouType("21/07", "DD/MM/YYYY", "21/0")).toBe("21/07/");
      expect(formatDateInputAsYouType("21/07/2", "DD/MM/YYYY", "21/07/")).toBe("21/07/2");
      expect(formatDateInputAsYouType("21/07/2026", "DD/MM/YYYY", "21/07/202")).toBe("21/07/2026");
    });

    it("auto-inserts - for year-first YYYY-MM-DD as user types digits", () => {
      expect(formatDateInputAsYouType("202", "YYYY-MM-DD", "")).toBe("202");
      expect(formatDateInputAsYouType("2026", "YYYY-MM-DD", "202")).toBe("2026-");
      expect(formatDateInputAsYouType("2026-0", "YYYY-MM-DD", "2026-")).toBe("2026-0");
      expect(formatDateInputAsYouType("2026-07", "YYYY-MM-DD", "2026-0")).toBe("2026-07-");
      expect(formatDateInputAsYouType("2026-07-2", "YYYY-MM-DD", "2026-07-")).toBe("2026-07-2");
      expect(formatDateInputAsYouType("2026-07-21", "YYYY-MM-DD", "2026-07-2")).toBe("2026-07-21");

      // Backspacing year separator
      expect(formatDateInputAsYouType("2026", "YYYY-MM-DD", "2026-")).toBe("2026");
    });

    it("auto-formats pasted 8-digit strings with / separators", () => {
      expect(formatDateInputAsYouType("21072026", "DD/MM/YYYY")).toBe("21/07/2026");
      expect(formatDateInputAsYouType("07212026", "MM/DD/YYYY")).toBe("07/21/2026");
      expect(formatDateInputAsYouType("20260721", "YYYY/MM/DD")).toBe("2026/07/21");
      expect(formatDateInputAsYouType("20260721", "YYYY-MM-DD")).toBe("2026-07-21");
      expect(formatDateInputAsYouType("21072026", "DD.MM.YYYY")).toBe("21.07.2026");
    });

    it("allows backspacing without fighting auto-separator", () => {
      // User pressed backspace from "21/" to "21"
      expect(formatDateInputAsYouType("21", "DD/MM/YYYY", "21/")).toBe("21");
      // User pressed backspace from "21/07/" to "21/07"
      expect(formatDateInputAsYouType("21/07", "DD/MM/YYYY", "21/07/")).toBe("21/07");
    });

    it("handles explicit single digit entries with slashes", () => {
      expect(formatDateInputAsYouType("5/", "DD/MM/YYYY")).toBe("5/");
      expect(formatDateInputAsYouType("5/7/", "DD/MM/YYYY")).toBe("5/7/");
      expect(formatDateInputAsYouType("5/7/2026", "DD/MM/YYYY")).toBe("5/7/2026");
    });
  });

  describe("Locale & Preset Discovery Helpers", () => {
    it("detects regional date format preset from language code", () => {
      expect(detectLocaleDateFormat("en")).toBe("DD/MM/YYYY");
      expect(detectLocaleDateFormat("ar")).toBe("DD/MM/YYYY");
    });

    it("returns all preset configurations and live select options", () => {
      const presets = getDateFormatPresets();
      expect(presets.length).toBe(DATE_FORMAT_PRESET_IDS.length);

      const sampleDate = new Date(Date.UTC(2026, 6, 21));
      const options = getDateFormatOptions("en", sampleDate);
      expect(options.length).toBe(DATE_FORMAT_PRESET_IDS.length);
      expect(typeof options[0]?.sample).toBe("string");
      expect(options[0]!.sample.length).toBeGreaterThan(0);
    });
  });

  describe("Date Storage & ISO Helpers", () => {
    it("formats a Date object to YYYY-MM-DD and retrieves todayISO", () => {
      const date = new Date(2026, 6, 21);
      expect(formatDateToIso(date)).toBe("2026-07-21");
      expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("extracts year portion via parseIsoYear", () => {
      expect(parseIsoYear("2026-07-21")).toBe(2026);
      expect(parseIsoYear("2026-07-21T14:30:00.000Z")).toBe(2026);
      expect(parseIsoYear(null)).toBeUndefined();
      expect(parseIsoYear("invalid")).toBeUndefined();
    });

    it("parses year representations via parseYearValue", () => {
      expect(parseYearValue(2026)).toBe(2026);
      expect(parseYearValue("2026")).toBe(2026);
      expect(parseYearValue(" 2026 ")).toBe(2026);
      expect(parseYearValue("2026-07-21")).toBe(2026);
      expect(parseYearValue("2026-07-21T14:30:00.000Z")).toBe(2026);
      expect(parseYearValue(new Date(2026, 0, 1))).toBe(2026);

      expect(parseYearValue(null)).toBeUndefined();
      expect(parseYearValue(undefined)).toBeUndefined();
      expect(parseYearValue("")).toBeUndefined();
      expect(parseYearValue("   ")).toBeUndefined();
      expect(parseYearValue(999)).toBeUndefined();
      expect(parseYearValue(10000)).toBeUndefined();
      expect(parseYearValue("invalid")).toBeUndefined();
    });

    it("evaluates year bounds with isYearWithinBounds", () => {
      expect(isYearWithinBounds(2026, 2020, 2030)).toBe(true);
      expect(isYearWithinBounds(2020, 2020, 2030)).toBe(true);
      expect(isYearWithinBounds(2030, 2020, 2030)).toBe(true);
      expect(isYearWithinBounds(2019, 2020, 2030)).toBe(false);
      expect(isYearWithinBounds(2031, 2020, 2030)).toBe(false);

      // Unbounded or null bounds
      expect(isYearWithinBounds(2026, null, null)).toBe(true);
      expect(isYearWithinBounds(2026, 2020, null)).toBe(true);
      expect(isYearWithinBounds(2026, null, 2030)).toBe(true);
    });

    it("resolves year bounds defaults and custom inputs with resolveYearPickerBounds", () => {
      const currentYear = new Date().getFullYear();
      const defaults = resolveYearPickerBounds(null, null);
      expect(defaults.minYear).toBe(currentYear - DATE_PICKER_YEAR_PAST);
      expect(defaults.maxYear).toBe(currentYear + DATE_PICKER_YEAR_FUTURE);

      const customNumbers = resolveYearPickerBounds(null, null, 2015, 2035);
      expect(customNumbers.minYear).toBe(2015);
      expect(customNumbers.maxYear).toBe(2035);

      const customIsoStrings = resolveYearPickerBounds("2010-01-01", "2040-12-31");
      expect(customIsoStrings.minYear).toBe(2010);
      expect(customIsoStrings.maxYear).toBe(2040);

      const customYearStrings = resolveYearPickerBounds("2012", "2028");
      expect(customYearStrings.minYear).toBe(2012);
      expect(customYearStrings.maxYear).toBe(2028);
    });
  });

  describe("isDateWithinIsoBounds / resolveDatePickerMonthBounds", () => {
    it("enforces optional min and max ISO bounds with null and undefined", () => {
      const mid = parseIsoDate("2026-06-15")!;
      expect(isDateWithinIsoBounds(mid)).toBe(true);
      expect(isDateWithinIsoBounds(mid, "2026-06-15", "2026-06-15")).toBe(true);
      expect(isDateWithinIsoBounds(mid, "2026-06-16")).toBe(false);
      expect(isDateWithinIsoBounds(mid, undefined, "2026-06-14")).toBe(false);
      expect(isDateWithinIsoBounds(mid, null, null)).toBe(true);
    });

    it("handles non-midnight dates when comparing against calendar bounds", () => {
      // 18:45 on the same day as max bound should still be within bounds
      const afternoonDate = new Date(2026, 5, 15, 18, 45, 0);
      expect(isDateWithinIsoBounds(afternoonDate, "2026-06-01", "2026-06-15")).toBe(true);
      expect(isDateWithinIsoBounds(afternoonDate, "2026-06-15", "2026-06-30")).toBe(true);

      // Date on the next day should be rejected
      const nextDay = new Date(2026, 5, 16, 1, 0, 0);
      expect(isDateWithinIsoBounds(nextDay, "2026-06-01", "2026-06-15")).toBe(false);
    });

    it("resolves caption month window from ISO bounds or defaults", () => {
      const bounded = resolveDatePickerMonthBounds("2020-03-01", "2030-08-01");
      expect(bounded.startMonth.getFullYear()).toBe(2020);
      expect(bounded.startMonth.getMonth()).toBe(0);
      expect(bounded.endMonth.getFullYear()).toBe(2030);
      expect(bounded.endMonth.getMonth()).toBe(11);

      const open = resolveDatePickerMonthBounds(null, null);
      const year = new Date().getFullYear();
      expect(open.startMonth.getFullYear()).toBe(year - DATE_PICKER_YEAR_PAST);
      expect(open.endMonth.getFullYear()).toBe(year + DATE_PICKER_YEAR_FUTURE);
    });
  });

  describe("Time & DateTime Utilities", () => {
    it("parses and formats 24h clock times accurately", () => {
      expect(parseTimeHHmm("14:30")).toEqual({ hours: 14, minutes: 30 });
      expect(parseTimeHHmm("9:05")).toEqual({ hours: 9, minutes: 5 });
      expect(parseTimeHHmm("14:30:45")).toEqual({ hours: 14, minutes: 30 });

      // Out of bounds
      expect(parseTimeHHmm("24:00")).toBeNull();
      expect(parseTimeHHmm("12:60")).toBeNull();
      expect(parseTimeHHmm("")).toBeNull();
      expect(parseTimeHHmm(null)).toBeNull();
      expect(parseTimeHHmm(undefined)).toBeNull();
      expect(parseTimeHHmm("invalid")).toBeNull();

      expect(formatTimeHHmm(9, 5)).toBe("09:05");
      expect(formatTimeHHmm(14, 30)).toBe("14:30");
    });

    it("normalizes time strings to zero-padded HH:mm", () => {
      expect(normalizeTimeHHmm("9:5")).toBe("09:05");
      expect(normalizeTimeHHmm("14:30:45")).toBe("14:30");
      expect(normalizeTimeHHmm(null)).toBe("");
      expect(normalizeTimeHHmm("invalid")).toBe("");
    });

    it("splits ISO datetime into local date and time components", () => {
      const parts = splitIsoDateTime("2026-07-21T14:30:00.000Z");
      expect(parts).not.toBeNull();
      expect(parts?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(parts?.time).toMatch(/^\d{2}:\d{2}$/);

      expect(splitIsoDateTime("")).toBeNull();
      expect(splitIsoDateTime(null)).toBeNull();
      expect(splitIsoDateTime("not-a-datetime")).toBeNull();
    });

    it("combines local date and time into ISO-8601 string", () => {
      const combined = combineIsoDateAndTime("2026-07-21", "14:30");
      expect(combined).not.toBeNull();
      expect(typeof combined).toBe("string");
      expect(new Date(combined!).getFullYear()).toBe(2026);

      // Default time when missing or invalid
      const defaultTime = combineIsoDateAndTime("2026-07-21", "");
      expect(defaultTime).not.toBeNull();
      expect(combineIsoDateAndTime("2026-07-21", null)).not.toBeNull();

      // Returns null when date is empty or invalid
      expect(combineIsoDateAndTime("", "14:30")).toBeNull();
      expect(combineIsoDateAndTime(null, "14:30")).toBeNull();
      expect(combineIsoDateAndTime("invalid", "14:30")).toBeNull();
    });
  });
});
