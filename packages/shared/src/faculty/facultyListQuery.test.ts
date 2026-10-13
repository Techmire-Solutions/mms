import { describe, expect, it } from "vitest";
import {
  isFacultyQuickFilter,
  FACULTY_QUICK_FILTER_OPTIONS,
  facultyQuickFilterStatusValue,
  FACULTY_SORT_FIELDS,
  FACULTY_SORT_FIELD_SET,
  facultyListQuerySchema,
} from "./facultyListQuery.js";

describe("facultyListQuerySchema", () => {
  it("parses list query with status and specialization filters", () => {
    const parsed = facultyListQuerySchema.parse({
      page: "1",
      limit: "50",
      status: "active,sabbatical",
      specialization: "Hifz",
      sortField: "name",
      sortDir: "asc",
    });
    expect(parsed.status).toBe("active,sabbatical");
    expect(parsed.specialization).toBe("Hifz");
    expect(parsed.sortField).toBe("name");
  });

  it("parses gender and quickFilter filters", () => {
    const parsed = facultyListQuerySchema.parse({
      gender: "male",
      quickFilter: "missingEmployeeId",
    });
    expect(parsed.gender).toBe("male");
    expect(parsed.quickFilter).toBe("missingEmployeeId");
  });

  it("rejects an unknown quickFilter preset", () => {
    const result = facultyListQuerySchema.safeParse({
      quickFilter: "bogus",
    });
    expect(result.success).toBe(false);
  });

  it("rejects sortField outside FACULTY_SORT_FIELDS", () => {
    const result = facultyListQuerySchema.safeParse({
      sortField: "bogus",
    });
    expect(result.success).toBe(false);
  });
});

describe("FACULTY_SORT_FIELDS", () => {
  it("includes employeeId and exposes a Set for SQL allowlists", () => {
    expect(FACULTY_SORT_FIELDS).toContain("employeeId");
    expect(FACULTY_SORT_FIELD_SET.has("name")).toBe(true);
    expect(FACULTY_SORT_FIELD_SET.has("bogus")).toBe(false);
  });
});

describe("FACULTY_QUICK_FILTERS", () => {
  it("exposes the status + missing-employee-id presets with label keys", () => {
    expect(FACULTY_QUICK_FILTER_OPTIONS).toEqual([
      { id: "all", labelKey: "faculty.filtersAll" },
      { id: "active", labelKey: "faculty.filtersActive" },
      { id: "inactive", labelKey: "faculty.filtersInactive" },
      { id: "onLeave", labelKey: "faculty.filtersOnLeave" },
      { id: "missingEmployeeId", labelKey: "faculty.filtersMissingEmployeeId" },
    ]);
  });

  it("narrows valid preset strings", () => {
    expect(isFacultyQuickFilter("active")).toBe(true);
    expect(isFacultyQuickFilter("all")).toBe(true);
    expect(isFacultyQuickFilter("bogus")).toBe(false);
  });

  it("maps status presets to stored status values and non-status presets to undefined", () => {
    expect(facultyQuickFilterStatusValue("active")).toBe("active");
    expect(facultyQuickFilterStatusValue("inactive")).toBe("inactive");
    expect(facultyQuickFilterStatusValue("onLeave")).toBe("on_leave");
    expect(facultyQuickFilterStatusValue("all")).toBeUndefined();
    expect(facultyQuickFilterStatusValue("missingEmployeeId")).toBeUndefined();
  });
});
