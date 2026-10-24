import { describe, expect, it } from "vitest";
import {
  STUDENT_LOOKUP_KINDS,
  STUDENT_LOOKUP_LEGACY_COLLECTION_KEYS,
  defaultStudentLookupItems,
  emptyStudentLookupsMap,
  isStudentLookupKind,
  isStudentLookupLegacyCollectionKey,
} from "./studentLookupTypes.js";

describe("studentLookupTypes", () => {
  it("exposes three Setup kinds mapped from legacy collections", () => {
    expect(STUDENT_LOOKUP_KINDS).toEqual(["statuses", "genderFilters", "discountTypes"]);
    expect(STUDENT_LOOKUP_LEGACY_COLLECTION_KEYS.studentStatuses).toBe("statuses");
    expect(isStudentLookupLegacyCollectionKey("studentStatuses")).toBe(true);
    expect(isStudentLookupKind("statuses")).toBe(true);
    expect(isStudentLookupKind("genders")).toBe(false);
  });

  it("defaults statuses and genderFilters; discountTypes start empty", () => {
    expect(defaultStudentLookupItems("statuses")).toContain("active");
    expect(defaultStudentLookupItems("genderFilters")).toEqual(["male", "female"]);
    expect(defaultStudentLookupItems("discountTypes")).toEqual([]);
    expect(emptyStudentLookupsMap().statuses.length).toBeGreaterThan(0);
  });
});
