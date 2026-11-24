import { describe, expect, it } from "vitest";
import {
  isInstitutionSetupComplete,
  formatBrandingAddress,
  mergeBrandingIdentityOverServerBaseline,
  pickDirtyBrandingFields,
  redactBrandingIdentityForClient,
} from "../branding/brandingSettingsUtils.js";
import {
  BRANDING_IDENTITY_FIELD_KEYS,
  DEFAULT_BRANDING_SETTINGS,
} from "../branding/brandingSettingsTypes.js";

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

describe("redactBrandingIdentityForClient", () => {
  it("keeps public identity + theme fields and strips contact/legal/address/social", () => {
    const redacted = redactBrandingIdentityForClient({
      madrasaName: "Dar ul Quran",
      tagline: "Centre of Learning",
      logoUrl: "https://cdn.example.com/logo.png",
      faviconUrl: "https://cdn.example.com/favicon.ico",
      primaryColor: "#036348",
      secondaryColor: "#9e340a",
      cornerStyle: "soft",
      footerText: "© 2026 Dar ul Quran",
      email: "admin@madrasa.org",
      phone: "+44123456789",
      website: "https://madrasa.org",
      legalName: "Dar ul Quran Trust",
      registrationNumber: "REG-123",
      addressLine1: "1 Main Street",
      addressLine2: "Suite 4",
      city: "Birmingham",
      region: "West Midlands",
      postalCode: "B11 4RA",
      country: "United Kingdom",
      socialLinks: [{ platform: "Facebook", url: "https://facebook.com/darulquran" }],
    });

    expect(redacted.madrasaName).toBe("Dar ul Quran");
    expect(redacted.tagline).toBe("Centre of Learning");
    expect(redacted.logoUrl).toBe("https://cdn.example.com/logo.png");
    expect(redacted.primaryColor).toBe("#036348");
    expect(redacted.secondaryColor).toBe("#9e340a");
    expect(redacted.cornerStyle).toBe("soft");
    expect(redacted.footerText).toBe("© 2026 Dar ul Quran");
    // Admin-only identity/contact fields are reset to defaults.
    expect(redacted.email).toBe("");
    expect(redacted.phone).toBe("");
    expect(redacted.website).toBe("");
    expect(redacted.legalName).toBe("");
    expect(redacted.registrationNumber).toBe("");
    expect(redacted.addressLine1).toBe("");
    expect(redacted.city).toBe("");
    expect(redacted.country).toBe("");
    expect(redacted.socialLinks).toEqual([]);
  });
});

describe("pickDirtyBrandingFields", () => {
  const baseline = {
    ...DEFAULT_BRANDING_SETTINGS,
    madrasaName: "Al-Noor Academy",
    city: "Karachi",
    socialLinks: [{ platform: "LinkedIn" as const, url: "https://linkedin.com/company/a" }],
  };

  it("returns only the fields the user changed", () => {
    const draft = {
      ...baseline,
      city: "Lahore",
      tagline: "New tagline",
    };

    expect(pickDirtyBrandingFields(draft, baseline, BRANDING_IDENTITY_FIELD_KEYS)).toEqual({
      city: "Lahore",
      tagline: "New tagline",
    });
  });

  it("returns an empty patch when the draft matches the baseline", () => {
    expect(pickDirtyBrandingFields(baseline, baseline, BRANDING_IDENTITY_FIELD_KEYS)).toEqual({});
  });

  it("detects social-link edits structurally", () => {
    const draft = {
      ...baseline,
      socialLinks: [{ platform: "LinkedIn" as const, url: "https://linkedin.com/company/b" }],
    };
    expect(pickDirtyBrandingFields(draft, baseline, BRANDING_IDENTITY_FIELD_KEYS)).toEqual({
      socialLinks: [{ platform: "LinkedIn", url: "https://linkedin.com/company/b" }],
    });
  });
});

describe("mergeBrandingIdentityOverServerBaseline", () => {
  const baseline = {
    ...DEFAULT_BRANDING_SETTINGS,
    madrasaName: "Local Madrasa",
    city: "",
    email: "",
    addressLine1: "",
  };

  const serverBaseline = {
    ...DEFAULT_BRANDING_SETTINGS,
    madrasaName: "Al-Noor Academy",
    city: "Karachi",
    email: "info@alnoor.test",
    legalName: "Al-Noor Education Trust",
    addressLine1: "12 Knowledge Road",
    region: "Sindh",
    socialLinks: [{ platform: "LinkedIn" as const, url: "https://linkedin.com/company/al-noor" }],
  };

  it("overlays only the edited identity fields on the server record", () => {
    const draft = { ...baseline, city: "Lahore", tagline: "Edited tagline" };

    const merged = mergeBrandingIdentityOverServerBaseline(draft, baseline, serverBaseline);

    expect(merged.city).toBe("Lahore");
    expect(merged.tagline).toBe("Edited tagline");
    // Untouched identity fields come from the fresh server record.
    expect(merged.email).toBe("info@alnoor.test");
    expect(merged.legalName).toBe("Al-Noor Education Trust");
    expect(merged.addressLine1).toBe("12 Knowledge Road");
    expect(merged.region).toBe("Sindh");
    expect(merged.madrasaName).toBe("Al-Noor Academy");
    expect(merged.socialLinks).toEqual([
      { platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" },
    ]);
  });

  it("recovers server values when the local baseline was never hydrated", () => {
    // The draft matches its (empty) baseline: nothing is dirty, so the server wins.
    const merged = mergeBrandingIdentityOverServerBaseline(baseline, baseline, serverBaseline);

    expect(merged.email).toBe("info@alnoor.test");
    expect(merged.addressLine1).toBe("12 Knowledge Road");
    expect(merged.city).toBe("Karachi");
  });

  it("keeps server theme fields while applying identity edits", () => {
    const themedServer = {
      ...serverBaseline,
      primaryColor: "#123456",
      cornerStyle: "soft" as const,
    };
    const draft = { ...baseline, phone: "+92 300 1234567" };

    const merged = mergeBrandingIdentityOverServerBaseline(draft, baseline, themedServer);

    expect(merged.phone).toBe("+923001234567");
    expect(merged.primaryColor).toBe("#123456");
    expect(merged.cornerStyle).toBe("soft");
  });
});
