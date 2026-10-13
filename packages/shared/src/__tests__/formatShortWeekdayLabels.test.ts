import { describe, expect, it } from "vitest";
import { formatShortWeekdayLabels } from "../settings/settingsTypes.js";

describe("formatShortWeekdayLabels", () => {
  it("returns seven Monday-first short weekday labels", () => {
    const labels = formatShortWeekdayLabels();
    expect(labels).toHaveLength(7);
    expect(labels.every((label) => typeof label === "string" && label.length > 0)).toBe(true);
  });
});
