import { describe, expect, it } from "vitest";
import {
  FACULTY_LOOKUP_KINDS,
  FACULTY_LOOKUP_LEGACY_COLLECTION_KEYS,
  defaultFacultyLookupItems,
  emptyFacultyLookupsMap,
  isFacultyLookupKind,
  isFacultyLookupLegacyCollectionKey,
} from "./facultyLookupTypes.js";

describe("facultyLookupTypes", () => {
  it("exposes statuses, specializations, and genderFilters Setup kinds", () => {
    expect(FACULTY_LOOKUP_KINDS).toEqual(["statuses", "specializations", "genderFilters"]);
    expect(FACULTY_LOOKUP_LEGACY_COLLECTION_KEYS.facultyStatuses).toBe("statuses");
    expect(isFacultyLookupLegacyCollectionKey("facultyStatuses")).toBe(true);
    expect(isFacultyLookupKind("statuses")).toBe(true);
    expect(isFacultyLookupKind("genderFilters")).toBe(true);
    expect(isFacultyLookupKind("designations")).toBe(false);
    expect(isFacultyLookupKind("departments")).toBe(false);
    expect(isFacultyLookupKind("genders")).toBe(false);
  });

  it("defaults statuses, specializations, and genderFilters from shared enums", () => {
    expect(defaultFacultyLookupItems("statuses")).toContain("active");
    expect(defaultFacultyLookupItems("specializations").length).toBeGreaterThan(0);
    expect(defaultFacultyLookupItems("genderFilters")).toEqual(["male", "female"]);
    expect(emptyFacultyLookupsMap().statuses.length).toBeGreaterThan(0);
    expect(emptyFacultyLookupsMap().genderFilters).toEqual(["male", "female"]);
    expect(emptyFacultyLookupsMap()).not.toHaveProperty("designations");
    expect(emptyFacultyLookupsMap()).not.toHaveProperty("departments");
  });
});
