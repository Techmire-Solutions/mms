import { afterEach, describe, expect, it } from "vitest";
import {
  formatDate,
  formatShortWeekdayLabels,
  getRecentMonthsList,
  registerSettingsProvider,
} from "./settingsDateFormatters.js";

describe("settingsDateFormatters", () => {
  afterEach(() => {
    registerSettingsProvider(null);
  });

  it("formats dates with the registered provider pattern", () => {
    registerSettingsProvider(() => ({
      dateFormat: "YYYY-MM-DD",
      timezone: "UTC",
      language: "en",
    }));

    expect(formatDate("2026-03-05T12:00:00.000Z")).toBe("2026-03-05");
    expect(formatDate(null)).toBe("—");
  });

  it("returns seven Monday-first short weekday labels", () => {
    const labels = formatShortWeekdayLabels();
    expect(labels).toHaveLength(7);
    expect(labels.every((label) => typeof label === "string" && label.length > 0)).toBe(true);
  });

  it("builds recent month keys ending with the current month", () => {
    const months = getRecentMonthsList(3);
    expect(months).toHaveLength(3);
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(months[2]?.key).toBe(currentKey);
    expect(months.every((entry) => entry.label.length > 0)).toBe(true);
  });
});
