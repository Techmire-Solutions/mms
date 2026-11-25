import { describe, expect, it } from "vitest";
import {
  FACULTY_IO_ENTITY_IDS,
  FACULTY_PAGE_TAB_DEFAULT,
  FACULTY_PAGE_TAB_IDS,
  migrateFacultyPageTab,
  resolveFacultyPageTab,
} from "./facultyPageWorkSubTabs";

describe("facultyPageWorkSubTabs", () => {
  it("exposes five peer tabs and three IO entities including departments", () => {
    expect(FACULTY_PAGE_TAB_IDS).toEqual([
      "faculties",
      "departments",
      "designations",
      "reports",
      "setup",
    ]);
    expect(FACULTY_IO_ENTITY_IDS).toEqual(["faculties", "departments", "designations"]);
  });

  it("migrates legacy work / operations onto appropriate peer tab", () => {
    expect(migrateFacultyPageTab("work", "departments")).toBe("departments");
    expect(migrateFacultyPageTab("departments")).toBe("departments");
    expect(migrateFacultyPageTab("operations", "designations")).toBe("designations");
    expect(migrateFacultyPageTab("work", "nope")).toBe(FACULTY_PAGE_TAB_DEFAULT);
    expect(migrateFacultyPageTab("reports")).toBe("reports");
  });

  it("resolves against visible ids and maps a legacy work sub-tab", () => {
    const visible = ["faculties", "departments", "designations", "reports"];
    expect(resolveFacultyPageTab("work", visible, "departments")).toBe("departments");
  });

  it("falls back to the first visible tab when the persisted tier is no longer visible", () => {
    // A persisted `setup` tier whose permission was revoked must not blank the
    // module body: resolve to a tab the user can actually see.
    const visible = ["faculties", "departments", "designations", "reports"];
    expect(resolveFacultyPageTab("setup", visible)).toBe("faculties");
    expect(resolveFacultyPageTab("reports", ["designations", "setup"])).toBe("designations");
    expect(resolveFacultyPageTab("", visible)).toBe("faculties");
    expect(resolveFacultyPageTab("nonsense", ["reports"])).toBe("reports");
  });

  it("returns an empty tab only when the caller offers no visible tab", () => {
    expect(resolveFacultyPageTab("setup", [])).toBe("");
  });
});
