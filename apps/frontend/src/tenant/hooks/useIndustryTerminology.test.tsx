import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  resolveNavLabel,
  useIndustryTerminology,
  type ResolvedIndustryTerminology,
} from "./useIndustryTerminology";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/config/tenantConfig", () => ({
  getCurrentSubdomain: () => "demo",
}));

vi.mock("@/tenant/hooks/useWorkspaceBySubdomain", () => ({
  useWorkspaceBySubdomain: () => ({
    data: { body: { workspace: { industryType: "general_school" } } },
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

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

describe("useIndustryTerminology hook", () => {
  it("resolves terminology keys based on workspace industry", () => {
    let result: ResolvedIndustryTerminology | undefined;
    function Harness() {
      result = useIndustryTerminology();
      return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<Harness />);
    });
    expect(result?.facultyLabel).toBe("organization.terminology.madrasa.facultyLabel");
    expect(result?.studentLabel).toBe("organization.terminology.madrasa.studentLabel");
  });
});
