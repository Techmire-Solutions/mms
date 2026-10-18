import { describe, expect, it } from "vitest";
import {
  isInstitutionSetupComplete,
  formatBrandingAddress,
} from "../branding/brandingSettingsUtils.js";

describe("isInstitutionSetupComplete", () => {
  it("returns false for null or undefined input", () => {
    expect(isInstitutionSetupComplete(null)).toBe(false);
    expect(isInstitutionSetupComplete(undefined)).toBe(false);
  });

  it("returns false when mandatory fields are missing or empty", () => {
    // Only madrasaName present (like after initial platform onboarding)
    expect(
      isInstitutionSetupComplete({
        madrasaName: "Dar ul Quran",
      }),
    ).toBe(false);

    // Missing address and postal code
    expect(
      isInstitutionSetupComplete({
        madrasaName: "Dar ul Quran",
        tagline: "Centre of Learning",
        email: "info@madrasa.org",
        phone: "+44 7700 900000",
        addressLine1: "123 Main St",
        city: "London",
        country: "United Kingdom",
        postalCode: "",
      }),
    ).toBe(false);
  });

  it("returns true when all mandatory identity, contact, and address fields are filled", () => {
    expect(
      isInstitutionSetupComplete({
        madrasaName: "Dar ul Quran",
        tagline: "Centre of Islamic Studies",
        email: "contact@darulquran.org",
        phone: "+44 7700 900123",
        addressLine1: "45 Crescent Road",
        city: "Birmingham",
        country: "United Kingdom",
        postalCode: "B11 4RA",
      }),
    ).toBe(true);
  });
});

describe("formatBrandingAddress", () => {
  it("formats address components into a single readable line", () => {
    const formatted = formatBrandingAddress({
      addressLine1: "12 High Street",
      addressLine2: "Suite 4",
      city: "Manchester",
      region: "Greater Manchester",
      postalCode: "M1 1AA",
      country: "UK",
    });
    expect(formatted).toBe("12 High Street, Suite 4, Manchester, Greater Manchester, M1 1AA, UK");
  });
});
