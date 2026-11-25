import { describe, expect, it } from "vitest";
import type { BrandingSettings } from "@mms/contracts";
import { isInstitutionProfileComplete } from "./SetupIncompleteCallout";

function branding(partial: Partial<BrandingSettings>): BrandingSettings {
  return partial as BrandingSettings;
}

describe("isInstitutionProfileComplete", () => {
  it("is incomplete when only a tagline is set", () => {
    expect(isInstitutionProfileComplete(branding({ tagline: "Excellence" }))).toBe(false);
  });

  it("is incomplete with a logo but no contact field", () => {
    expect(isInstitutionProfileComplete(branding({ logoUrl: "https://x/logo.png" }))).toBe(false);
  });

  it("is incomplete with a contact field but no logo", () => {
    expect(isInstitutionProfileComplete(branding({ email: "admin@x.test" }))).toBe(false);
  });

  it("is complete with a logo and a contact field", () => {
    expect(
      isInstitutionProfileComplete(branding({ logoUrl: "https://x/logo.png", country: "PK" })),
    ).toBe(true);
  });
});
