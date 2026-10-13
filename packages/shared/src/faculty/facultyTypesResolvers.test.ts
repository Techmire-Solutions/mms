import { describe, expect, it } from "vitest";
import {
  DEFAULT_FACULTY_SPECIALIZATION,
  DEFAULT_FACULTY_STATUS,
  resolveFacultySpecializations,
  resolveFacultyStatus,
  resolveFacultyStatusRoles,
  resolveFacultyStatuses,
  FACULTY_SPECIALIZATION_VALUES,
  FACULTY_STATUS_VALUES,
} from "./facultyTypes.js";

describe("resolveFacultyStatuses / resolveFacultySpecializations", () => {
  it("DEFAULT_FACULTY_STATUS matches the first status value", () => {
    expect(DEFAULT_FACULTY_STATUS).toBe(FACULTY_STATUS_VALUES[0]);
  });

  it("DEFAULT_FACULTY_SPECIALIZATION is in FACULTY_SPECIALIZATION_VALUES", () => {
    expect(FACULTY_SPECIALIZATION_VALUES).toContain(DEFAULT_FACULTY_SPECIALIZATION);
    expect(DEFAULT_FACULTY_SPECIALIZATION).toBe("General");
  });

  it("falls back to shared defaults when empty", () => {
    expect(resolveFacultyStatuses()).toEqual(FACULTY_STATUS_VALUES);
    expect(resolveFacultyStatuses([])).toEqual(FACULTY_STATUS_VALUES);
    expect(resolveFacultySpecializations(null)).toEqual(FACULTY_SPECIALIZATION_VALUES);
  });

  it("prefers configured lists when non-empty", () => {
    expect(resolveFacultyStatuses(["active", "inactive"])).toEqual(["active", "inactive"]);
    expect(resolveFacultySpecializations(["Hifz"])).toEqual(["Hifz"]);
  });
});

describe("resolveFacultyStatus", () => {
  it("returns the provided status when present", () => {
    expect(resolveFacultyStatus("on_leave")).toBe("on_leave");
    expect(resolveFacultyStatus("custom")).toBe("custom");
  });

  it("falls back to DEFAULT_FACULTY_STATUS when unset", () => {
    expect(resolveFacultyStatus()).toBe(DEFAULT_FACULTY_STATUS);
    expect(resolveFacultyStatus(undefined)).toBe(DEFAULT_FACULTY_STATUS);
    expect(resolveFacultyStatus("")).toBe(DEFAULT_FACULTY_STATUS);
    expect(resolveFacultyStatus(null)).toBe(DEFAULT_FACULTY_STATUS);
  });
});

describe("resolveFacultyStatusRoles", () => {
  it("maps FACULTY_STATUS_VALUES to named roles in order", () => {
    const [active, onLeave, inactive, retired, terminated] = FACULTY_STATUS_VALUES;
    expect(resolveFacultyStatusRoles()).toEqual({ active, onLeave, inactive, retired, terminated });
  });
});
