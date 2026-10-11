import { describe, expect, it } from "vitest";
import {
  buildStudentsPageUrl,
  studentsListQueryKeyParams,
  studentsPaginatedQueryKey,
  sameStudentsListFilters,
  type StudentsPaginatedParams,
} from "@/tenant/features/students/hooks/studentsListQueryBuilders";

const base: StudentsPaginatedParams = { page: 1 };

describe("buildStudentsPageUrl", () => {
  it("builds the base students URL with default page size", () => {
    expect(buildStudentsPageUrl({ page: 3 })).toBe("/api/students?page=3&limit=50");
  });

  it("appends every optional filter", () => {
    const url = buildStudentsPageUrl({
      page: 2,
      limit: 50,
      search: "  ali  ",
      status: "active",
      gender: "male",
      quickFilter: "active",
      sortField: "grNumber",
      sortDir: "desc",
      includeDeleted: true,
      sessionId: "s-1",
      className: "Grade 5",
    });
    expect(url).toBe(
      "/api/students?page=2&limit=50&search=ali&status=active&gender=male&quickFilter=active&sortField=grNumber&sortDir=desc&includeDeleted=true&sessionId=s-1&className=Grade+5",
    );
  });

  it("omits quickFilter 'all' and empty search", () => {
    const url = buildStudentsPageUrl({ page: 1, quickFilter: "all", search: "   " });
    expect(url).toBe("/api/students?page=1&limit=50");
  });
});

describe("studentsListQueryKeyParams", () => {
  it("normalizes defaults", () => {
    expect(studentsListQueryKeyParams({ page: 1 })).toEqual({
      page: 1,
      limit: 50,
      search: "",
      status: "",
      gender: "",
      quickFilter: "all",
      sortField: "",
      sortDir: "",
      includeDeleted: false,
      sessionId: "",
      className: "",
    });
  });

  it("trims search and drops quickFilter 'all'", () => {
    const params = studentsListQueryKeyParams({
      page: 2,
      search: "  zain  ",
      quickFilter: "all",
      sortDir: "desc",
    });
    expect(params.search).toBe("zain");
    expect(params.quickFilter).toBe("all");
    expect(params.sortDir).toBe("desc");
  });
});

describe("studentsPaginatedQueryKey", () => {
  it("is a tuple prefixed by the students query key", () => {
    const key = studentsPaginatedQueryKey({ page: 1 });
    expect(key).toBeInstanceOf(Array);
    expect(key[0]).toBe("students");
    expect(key[1]).toBe("list");
    expect(key[2]).toBe("page");
    expect(key[3]).toMatchObject({ page: 1 });
  });
});

describe("sameStudentsListFilters", () => {
  it("returns false for undefined previous", () => {
    expect(sameStudentsListFilters(undefined, studentsListQueryKeyParams(base))).toBe(false);
  });

  it("returns true for identical params", () => {
    const params = studentsListQueryKeyParams({ page: 1, search: "a" });
    expect(
      sameStudentsListFilters(params, studentsListQueryKeyParams({ page: 1, search: "a" })),
    ).toBe(true);
  });

  it("returns false when a filter differs", () => {
    const params = studentsListQueryKeyParams({ page: 1, search: "a" });
    expect(
      sameStudentsListFilters(params, studentsListQueryKeyParams({ page: 1, search: "b" })),
    ).toBe(false);
  });
});
