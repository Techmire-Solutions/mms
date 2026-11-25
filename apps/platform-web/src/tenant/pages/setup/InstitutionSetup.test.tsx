import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BRANDING_SETTINGS, mergeBrandingSettings } from "@mms/contracts";
import InstitutionSetup from "@/tenant/pages/setup/InstitutionSetup";

const mockSaveBrandingSettings = vi.fn(async (_branding: Record<string, unknown>) => ({
  ok: true,
}));
const mockFetchBrandingFromServer = vi.fn();
const mockMarkInstitutionSetupComplete = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const localBranding = mergeBrandingSettings({
  ...DEFAULT_BRANDING_SETTINGS,
  madrasaName: "Local Madrasa",
});

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => localBranding,
}));

vi.mock("@/lib/db", async () => {
  const shared = await import("@mms/contracts");
  return {
    saveBrandingSettings: (branding: Record<string, unknown>) => mockSaveBrandingSettings(branding),
    getBrandingSettings: () => shared.mergeBrandingSettings(shared.DEFAULT_BRANDING_SETTINGS),
  };
});

vi.mock("@/lib/brandingHydration", () => ({
  fetchBrandingFromServer: (...args: unknown[]) => mockFetchBrandingFromServer(...args),
}));

vi.mock("@mms/fe-core/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/components/entry/EntryPageHead", () => ({
  default: () => null,
  formatEntryTitle: (title: string) => title,
}));

vi.mock("@/components/branding/BrandingIdentityPreview", () => ({ default: () => null }));

vi.mock("@/tenant/hooks/useInstitutionSetupStatus", () => ({
  useMarkInstitutionSetupComplete: () => mockMarkInstitutionSetupComplete,
}));

const FILLED = {
  tagline: "Learn with excellence",
  email: "info@alnoor.test",
  phone: "+92 300 1234567",
  addressLine1: "12 Knowledge Road",
  city: "Karachi",
  country: "Pakistan",
  postalCode: "75500",
} as const;

/**
 * Lightweight stand-in for the real form sections: deterministic fill buttons keep
 * the submit-path test independent of the field components' implementation.
 */
vi.mock("@/tenant/pages/setup/InstitutionSetupFormSections", () => ({
  InstitutionSetupFormSections: ({
    updateField,
  }: {
    updateField: (field: keyof typeof FILLED, value: string) => void;
  }) => (
    <div>
      {(Object.keys(FILLED) as Array<keyof typeof FILLED>).map((field) => (
        <button
          key={field}
          type="button"
          data-testid={`fill-${field}`}
          onClick={() => updateField(field, FILLED[field])}
        />
      ))}
    </div>
  ),
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const serverBranding = mergeBrandingSettings({
  ...DEFAULT_BRANDING_SETTINGS,
  madrasaName: "Al-Noor Academy",
  email: "old@alnoor.test",
  city: "Sukkur",
  legalName: "Al-Noor Education Trust",
  registrationNumber: "REG-2026-0042",
  region: "Sindh",
  website: "https://alnoor.test",
  primaryColor: "#123456",
  footerText: "© Al-Noor Academy",
  socialLinks: [{ platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" }],
});

async function mount(): Promise<{
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
}> {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(<InstitutionSetup />);
  });
  return { container, root };
}

async function fillRequiredFields(container: HTMLDivElement): Promise<void> {
  for (const field of Object.keys(FILLED)) {
    const button = container.querySelector(`[data-testid="fill-${field}"]`);
    expect(button).not.toBeNull();
    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }
}

async function submit(container: HTMLDivElement): Promise<void> {
  const form = container.querySelector("form");
  expect(form).not.toBeNull();
  await act(async () => {
    form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("InstitutionSetup Component", () => {
  it("instantiates InstitutionSetup component definition", () => {
    const element = <InstitutionSetup />;
    expect(element.type).toBe(InstitutionSetup);
  });
});

describe("InstitutionSetup server-authoritative save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBrandingFromServer.mockResolvedValue(serverBranding);
    mockSaveBrandingSettings.mockResolvedValue({ ok: true });
  });

  it("keeps untouched server fields while persisting the operator's edits", async () => {
    const { container, root } = await mount();
    await fillRequiredFields(container);
    await submit(container);

    expect(mockFetchBrandingFromServer).toHaveBeenCalledTimes(1);
    expect(mockSaveBrandingSettings).toHaveBeenCalledTimes(1);
    expect(mockMarkInstitutionSetupComplete).toHaveBeenCalledTimes(1);

    const saved = mockSaveBrandingSettings.mock.calls[0]![0] as Record<string, unknown>;
    // Edited identity fields win…
    expect(saved.tagline).toBe("Learn with excellence");
    expect(saved.email).toBe("info@alnoor.test");
    expect(saved.city).toBe("Karachi");
    // …fields the setup form never edits come from the fresh server record.
    expect(saved.legalName).toBe("Al-Noor Education Trust");
    expect(saved.registrationNumber).toBe("REG-2026-0042");
    expect(saved.region).toBe("Sindh");
    expect(saved.website).toBe("https://alnoor.test");
    expect(saved.madrasaName).toBe("Al-Noor Academy");
    expect(saved.primaryColor).toBe("#123456");
    expect(saved.socialLinks).toEqual([
      { platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" },
    ]);

    act(() => root.unmount());
  });

  it("falls back to the mount-time baseline when the server read fails", async () => {
    mockFetchBrandingFromServer.mockResolvedValue(null);
    const { container, root } = await mount();
    await fillRequiredFields(container);
    await submit(container);

    const saved = mockSaveBrandingSettings.mock.calls[0]![0] as Record<string, unknown>;
    expect(saved.city).toBe("Karachi");
    // The platform-managed name still comes from the hydrated baseline.
    expect(saved.madrasaName).toBe("Local Madrasa");

    act(() => root.unmount());
  });
});
