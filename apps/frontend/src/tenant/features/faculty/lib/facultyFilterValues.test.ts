import { describe, expect, it } from "vitest";
import {
  FACULTY_FILTER_ALL,
  facultyFilterMenuValue,
  normalizeFacultyFilterValue,
} from "@/tenant/features/faculty/lib/facultyFilterValues";
import { buildFacultyDirectoryQuery } from "@/tenant/features/faculty/hooks/facultyQueryShared";

describe("normalizeFacultyFilterValue", () => {
  it("maps the neutral menu option to no filter", () => {
    expect(normalizeFacultyFilterValue(FACULTY_FILTER_ALL)).toBe("");
    expect(normalizeFacultyFilterValue(" all ")).toBe("");
  });

  it("keeps a real selection and trims it", () => {
    expect(normalizeFacultyFilterValue(" male ")).toBe("male");
    expect(normalizeFacultyFilterValue("Tajweed")).toBe("Tajweed");
    expect(normalizeFacultyFilterValue("")).toBe("");
  });
});

describe("facultyFilterMenuValue", () => {
  it("points the menu at the neutral option when nothing is filtered", () => {
    expect(facultyFilterMenuValue("")).toBe(FACULTY_FILTER_ALL);
    expect(facultyFilterMenuValue("  ")).toBe(FACULTY_FILTER_ALL);
  });

  it("keeps the stored selection", () => {
    expect(facultyFilterMenuValue("female")).toBe("female");
  });
});

describe("buildFacultyDirectoryQuery neutral filters", () => {
  const base = {
    search: "",
    filterStatus: [],
    filterSpecialization: "",
    filterGender: "",
    quickFilter: "all" as const,
    sortField: null,
    sortDir: "asc" as const,
  };

  it("drops a raw `all` selection instead of sending it to the server", () => {
    const query = buildFacultyDirectoryQuery({
      ...base,
      filterGender: "all",
      filterSpecialization: "all",
      filterDepartment: "all",
      filterDesignation: "all",
      filterReportingFacultyId: "all",
    });

    expect(query.gender).toBeUndefined();
    expect(query.specialization).toBeUndefined();
    expect(query.department).toBeUndefined();
    expect(query.designation).toBeUndefined();
    expect(query.reportingFacultyId).toBeUndefined();
  });

  it("keeps real selections", () => {
    const query = buildFacultyDirectoryQuery({
      ...base,
      filterGender: "female",
      filterSpecialization: "Tajweed",
    });

    expect(query.gender).toBe("female");
    expect(query.specialization).toBe("Tajweed");
  });
});
