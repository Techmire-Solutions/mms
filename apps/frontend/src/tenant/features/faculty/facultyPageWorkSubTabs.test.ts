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
  it("exposes four peer tabs and two IO entities (no departments tab)", () => {
    expect(FACULTY_PAGE_TAB_IDS).toEqual(["faculties", "designations", "reports", "setup"]);
    expect(FACULTY_IO_ENTITY_IDS).toEqual(["faculties", "designations"]);
  });

  it("migrates legacy work / departments onto faculties or designations", () => {
    expect(migrateFacultyPageTab("work", "departments")).toBe(FACULTY_PAGE_TAB_DEFAULT);
    expect(migrateFacultyPageTab("departments")).toBe(FACULTY_PAGE_TAB_DEFAULT);
    expect(migrateFacultyPageTab("operations", "designations")).toBe("designations");
    expect(migrateFacultyPageTab("work", "nope")).toBe(FACULTY_PAGE_TAB_DEFAULT);
    expect(migrateFacultyPageTab("reports")).toBe("reports");
  });

  it("resolves against visible ids and supports legacy work sub-tab helper", () => {
    const visible = ["faculties", "designations", "reports"];
    expect(resolveFacultyPageTab("work", visible, "departments")).toBe("faculties");
    expect(resolveFacultyPageTab("setup", visible)).toBe("");
    expect(resolveFacultyPageTab("", visible)).toBe("");
    expect(resolveFacultyWorkSubTab("designations")).toBe("designations");
    expect(resolveFacultyWorkSubTab("nope")).toBe(FACULTY_PAGE_TAB_DEFAULT);
  });
});
