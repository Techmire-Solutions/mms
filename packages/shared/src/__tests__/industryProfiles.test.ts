import { describe, expect, it } from "vitest";
import {
  INDUSTRY_PROFILES,
  getIndustryProfile,
  getRecommendedModulesForIndustry,
  getRecommendedRolesForIndustry,
  getTerminologyForIndustry,
} from "../industryProfiles.js";
import { INDUSTRY_TYPES } from "../industryTypes.js";

describe("industryProfiles", () => {
  it("covers all supported industry types", () => {
    for (const type of INDUSTRY_TYPES) {
      expect(INDUSTRY_PROFILES[type]).toBeDefined();
      expect(INDUSTRY_PROFILES[type].id).toBe(type);
    }
  });

  it("provides independent recommended modules for hotel industry", () => {
    const modules = getRecommendedModulesForIndustry("hotel");
    expect(modules).toContain("tasks");
    expect(modules).toContain("faculty");
    expect(modules).toContain("attendance");
    expect(modules).toContain("finance");
    expect(modules).toContain("accounting");
    expect(modules).not.toContain("students");
    expect(modules).not.toContain("hasanat");
  });

  it("provides tailored terminology keys without breaking canonical internal models", () => {
    const hotelTerms = getTerminologyForIndustry("hotel");
    expect(hotelTerms.staffSingularKey).toBe("organization.terminology.hotel.staffSingular");
    expect(hotelTerms.studentLabelKey).toBe("organization.terminology.hotel.studentLabel");

    const madrasaTerms = getTerminologyForIndustry("madrasa");
    expect(madrasaTerms.staffSingularKey).toBe("organization.terminology.madrasa.staffSingular");
    expect(madrasaTerms.studentLabelKey).toBe("organization.terminology.madrasa.studentLabel");
  });

  it("falls back safely to madrasa profile on unknown or empty input", () => {
    const fallback = getIndustryProfile(null);
    expect(fallback.id).toBe("madrasa");
  });

  it("exposes recommended roles as advisory labels without implying RBAC seeding", () => {
    const hotelRoles = getRecommendedRolesForIndustry("hotel");
    expect(hotelRoles).toContain("general_manager");
    expect(hotelRoles).toContain("admin");
    expect(getRecommendedRolesForIndustry("madrasa")).toContain("ustad");
  });
});
