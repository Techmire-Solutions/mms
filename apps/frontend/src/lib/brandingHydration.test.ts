import { beforeEach, describe, expect, it, vi } from "vitest";
import { readObjectLocal, writeObjectLocal } from "./dbObjectStorage";
import type { BrandingSettings } from "@mms/shared";

const mockApiFetch = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { fetchBrandingFromServer, hydrateBrandingFromServer } from "./brandingHydration";

const serverBranding = {
  madrasaName: "Al-Noor Academy",
  tagline: "Excellence in Islamic Education",
  primaryColor: "#123456",
  secondaryColor: "#654321",
  cornerStyle: "rounded",
  logoUrl: "",
  faviconUrl: "",
  footerText: "",
  email: "info@alnoor.test",
  phone: "+92 300 1234567",
  website: "https://alnoor.test",
  legalName: "Al-Noor Education Trust",
  registrationNumber: "REG-2026-0042",
  addressLine1: "12 Knowledge Road",
  addressLine2: "",
  city: "Karachi",
  region: "Sindh",
  postalCode: "75500",
  country: "Pakistan",
  socialLinks: [{ platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" }],
};

describe("brandingHydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("reads the persisted branding record from the tenant object endpoint", async () => {
    mockApiFetch.mockResolvedValue({ ok: true, json: async () => serverBranding });

    const branding = await fetchBrandingFromServer();

    expect(mockApiFetch).toHaveBeenCalledWith("/api/db/objects/branding");
    expect(branding).toMatchObject({
      email: "info@alnoor.test",
      city: "Karachi",
      socialLinks: [{ platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" }],
    });
  });

  it("returns null on a failed or malformed response", async () => {
    mockApiFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchBrandingFromServer()).resolves.toBeNull();

    mockApiFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await expect(fetchBrandingFromServer()).resolves.toBeNull();
  });

  it("copies the full institution record into the local store without recasing", async () => {
    mockApiFetch.mockResolvedValue({ ok: true, json: async () => serverBranding });

    await expect(hydrateBrandingFromServer()).resolves.toBe(true);

    const local = readObjectLocal<BrandingSettings>("branding");
    expect(local?.madrasaName).toBe("Al-Noor Academy");
    expect(local?.email).toBe("info@alnoor.test");
    expect(local?.socialLinks).toEqual([
      { platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" },
    ]);
  });

  it("keeps the local record when the request fails (fail-open)", async () => {
    writeObjectLocal("branding", {
      madrasaName: "Cached Madrasa",
    } as unknown as BrandingSettings);
    mockApiFetch.mockRejectedValue(new Error("offline"));

    await expect(hydrateBrandingFromServer()).resolves.toBe(false);
    const local = readObjectLocal<BrandingSettings>("branding");
    expect(local?.madrasaName).toBe("Cached Madrasa");
  });
});
