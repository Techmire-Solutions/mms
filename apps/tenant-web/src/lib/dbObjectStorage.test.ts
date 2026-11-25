import { describe, expect, it } from "vitest";
import {
  readObjectLocal,
  shouldSkipTitleCase,
  writeObjectLocal,
} from "@mms/fe-core/lib/dbObjectStorage";
import type { BrandingSettings } from "@mms/contracts";

describe("writeObjectLocal (branding)", () => {
  it("skips title-casing for the branding record", () => {
    expect(shouldSkipTitleCase("branding")).toBe(true);
    // Other display collections keep the legacy title-case behaviour.
    expect(shouldSkipTitleCase("contacts")).toBe(false);
  });

  it("persists organisation names and social platforms verbatim", () => {
    localStorage.clear();
    const branding = {
      madrasaName: "Al-Noor Academy",
      tagline: "Excellence in Islamic Education",
      legalName: "Dar-ul-Uloom Trust",
      city: "Karachi",
      country: "Pakistan",
      registrationNumber: "REG-2026-abc",
      socialLinks: [
        { platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" },
        { platform: "YouTube", url: "https://youtube.com/@alnoor" },
        { platform: "TikTok", url: "https://tiktok.com/@alnoor" },
      ],
    } as unknown as BrandingSettings;

    writeObjectLocal("branding", branding);

    const stored = readObjectLocal<BrandingSettings>("branding");
    expect(stored?.madrasaName).toBe("Al-Noor Academy");
    expect(stored?.legalName).toBe("Dar-ul-Uloom Trust");
    expect(stored?.registrationNumber).toBe("REG-2026-abc");
    expect(stored?.socialLinks?.map((link) => link.platform)).toEqual([
      "LinkedIn",
      "YouTube",
      "TikTok",
    ]);
  });
});
