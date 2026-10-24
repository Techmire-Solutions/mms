import { describe, expect, it } from "vitest";
import {
  buildFacultyPageUrl,
  sameFacultyListFilters,
  facultyListQueryKeyParams,
  facultyPaginatedQueryKey,
  type FacultyPaginatedParams,
} from "@/tenant/features/faculty/hooks/facultyListQueryBuilders";

const base: FacultyPaginatedParams = { page: 1 };

describe("buildFacultyPageUrl", () => {
  it("builds the base faculty URL with default page size", () => {
    expect(buildFacultyPageUrl({ page: 3 })).toBe("/api/faculty?page=3&limit=50");
  });

  it("appends every optional filter", () => {
    const url = buildFacultyPageUrl({
      page: 2,
      limit: 50,
      search: "  ali  ",
      status: "active,on_leave",
      specialization: "Hifz",
      gender: "male",
      quickFilter: "missingEmployeeId",
      sortField: "employeeId",
      sortDir: "desc",
      includeDeleted: true,
    });
    expect(url).toBe(
      "/api/faculty?page=2&limit=50&search=ali&status=active%2Con_leave&specialization=Hifz&gender=male&quickFilter=missingEmployeeId&sortField=employeeId&sortDir=desc&includeDeleted=true",
    );
  });

  it("omits the all quickFilter preset and empty filters", () => {
    const url = buildFacultyPageUrl({ page: 1, search: "   ", quickFilter: "all" });
    expect(url).toBe("/api/faculty?page=1&limit=50");
  });
});

describe("facultyListQueryKeyParams", () => {
  it("normalizes defaults and drops enabled", () => {
    expect(facultyListQueryKeyParams({ page: 1, enabled: true })).toEqual({
      page: 1,
      limit: 50,
      search: "",
      status: "",
      specialization: "",
      gender: "",
      quickFilter: "all",
      sortField: "",
      sortDir: "",
      department: "",
      designation: "",
      reportingFacultyId: "",
      includeDeleted: false,
    });
  });

  it("trims strings and coerces includeDeleted", () => {
    const params = facultyListQueryKeyParams({
      page: 2,
      search: "  zain  ",
      status: " active ",
      specialization: " Tajweed ",
      gender: " female ",
      quickFilter: "active",
      sortField: " name " as "name",
      sortDir: "desc",
      includeDeleted: true,
    });
    expect(params.search).toBe("zain");
    expect(params.status).toBe("active");
    expect(params.specialization).toBe("Tajweed");
    expect(params.gender).toBe("female");
    expect(params.quickFilter).toBe("active");
    expect(params.sortField).toBe("name");
    expect(params.sortDir).toBe("desc");
    expect(params.includeDeleted).toBe(true);
  });
});

describe("facultyPaginatedQueryKey", () => {
  it("is a tuple prefixed by the faculty query key", () => {
    const key = facultyPaginatedQueryKey({ page: 1 });
    expect(key).toBeInstanceOf(Array);
    expect(key[0]).toBe("faculty");
    expect(key[1]).toBe("list");
    expect(key[2]).toBe("page");
    expect(key[3]).toMatchObject({ page: 1 });
  });
});

describe("sameFacultyListFilters", () => {
  it("returns false for undefined previous", () => {
    expect(sameFacultyListFilters(undefined, facultyListQueryKeyParams(base))).toBe(false);
  });

  it("returns true for identical params", () => {
    const params = facultyListQueryKeyParams({ page: 1, search: "a" });
    expect(
      sameFacultyListFilters(params, facultyListQueryKeyParams({ page: 1, search: "a" })),
    ).toBe(true);
  });

  it("returns false when a filter differs", () => {
    const params = facultyListQueryKeyParams({ page: 1, search: "a" });
    expect(
      sameFacultyListFilters(params, facultyListQueryKeyParams({ page: 1, search: "b" })),
    ).toBe(false);
  });
});
