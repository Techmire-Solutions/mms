import { describe, expect, it } from "vitest";
import { defaultSessionsExportColumns } from "./useSessionsExportActions";

describe("defaultSessionsExportColumns", () => {
  it("resolves every label through t() with no English fallback", () => {
    // A translator that returns "" exposes the banned `t(key) || "English"` idiom: a fallback
    // would render the literal English string instead of the empty translation.
    const columns = defaultSessionsExportColumns(() => "", null);
    expect(columns.length).toBeGreaterThan(0);
    for (const column of columns) {
      expect(column.label, `column "${column.id}" has an English fallback`).toBe("");
    }
  });
});
