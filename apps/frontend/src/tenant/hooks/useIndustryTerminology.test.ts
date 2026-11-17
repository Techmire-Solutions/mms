import { describe, expect, it } from "vitest";
import { resolveNavLabel, type ResolvedIndustryTerminology } from "./useIndustryTerminology";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const terminology: ResolvedIndustryTerminology = {
  facultyLabel: "Staff & Team",
  staffSingular: "Staff",
  studentLabel: "Guests & Patrons",
  locationLabel: "Site",
};

const t = ((key: string) => key) as unknown as TranslationFunction;

describe("resolveNavLabel", () => {
  it("returns the industry faculty label for nav.faculty", () => {
    expect(resolveNavLabel("nav.faculty", terminology, t)).toBe("Staff & Team");
  });

  it("returns the industry student label for nav.students", () => {
    expect(resolveNavLabel("nav.students", terminology, t)).toBe("Guests & Patrons");
  });

  it("passes non-overridden keys through to t", () => {
    expect(resolveNavLabel("nav.academics", terminology, t)).toBe("nav.academics");
  });
});
