import { describe, expect, it } from "vitest";
import {
  FACULTY_IO_ENTITY_IDS,
  FACULTY_PAGE_TAB_DEFAULT,
  FACULTY_PAGE_TAB_IDS,
  migrateFacultyPageTab,
  resolveFacultyPageTab,
  resolveFacultyWorkSubTab,
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

  it("resolves against visible ids and supports legacy work sub-tab helper", () => {
    const visible = ["faculties", "departments", "designations", "reports"];
    expect(resolveFacultyPageTab("work", visible, "departments")).toBe("departments");
    expect(resolveFacultyPageTab("setup", visible)).toBe("");
    expect(resolveFacultyPageTab("", visible)).toBe("");
    expect(resolveFacultyWorkSubTab("designations")).toBe("designations");
    expect(resolveFacultyWorkSubTab("nope")).toBe(FACULTY_PAGE_TAB_DEFAULT);
  });
});
