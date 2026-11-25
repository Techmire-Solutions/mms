import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BRANDING_SETTINGS, mergeBrandingSettings } from "@mms/contracts";
import {
  SettingsBrandingDraftProvider,
  useSettingsBrandingDraft,
  type SettingsBrandingDraftContextValue,
} from "@/lib/contexts/SettingsBrandingDraftContext";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";

const mockSaveBrandingSettings = vi.fn(async (_branding: Record<string, unknown>) => ({
  ok: true,
}));
const mockFetchBrandingFromServer = vi.fn();

vi.mock("@/lib/db", async () => {
  const shared = await import("@mms/contracts");
  return {
    getBrandingSettings: vi.fn(() =>
      shared.mergeBrandingSettings({
        ...shared.DEFAULT_BRANDING_SETTINGS,
        madrasaName: "Local Madrasa",
        city: "",
      }),
    ),
    saveBrandingSettings: (branding: Record<string, unknown>) => mockSaveBrandingSettings(branding),
    getGlobalSettings: vi.fn(() => shared.DEFAULT_GLOBAL_SETTINGS),
    getEffectiveGlobalSettings: vi.fn(() => shared.DEFAULT_GLOBAL_SETTINGS),
    saveGlobalSettingsAsync: vi.fn(async () => ({ ok: true })),
  };
});

vi.mock("@/lib/brandingHydration", () => ({
  fetchBrandingFromServer: (...args: unknown[]) => mockFetchBrandingFromServer(...args),
}));

vi.mock("@/components/branding/BrandingShared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/branding/BrandingShared")>();
  const shared = await import("@mms/contracts");
  // Draft + baseline come from the same store in production; keep them aligned here.
  return {
    ...actual,
    loadBranding: () =>
      shared.mergeBrandingSettings({
        ...shared.DEFAULT_BRANDING_SETTINGS,
        madrasaName: "Local Madrasa",
        city: "",
      }),
  };
});

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const serverBranding = mergeBrandingSettings({
  ...DEFAULT_BRANDING_SETTINGS,
  madrasaName: "Al-Noor Academy",
  tagline: "Platform tagline",
  email: "info@alnoor.test",
  phone: "+92 300 1234567",
  legalName: "Al-Noor Education Trust",
  addressLine1: "12 Knowledge Road",
  city: "Karachi",
  country: "Pakistan",
  postalCode: "75500",
  socialLinks: [{ platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" }],
});

let draft: SettingsBrandingDraftContextValue | null = null;

function TestComponent(): React.JSX.Element {
  draft = useSettingsBrandingDraft();
  return <div />;
}

const mockT = ((key: string) => key) as unknown as TranslationFunction;

function Harness(): React.JSX.Element {
  return (
    <TranslationContext.Provider
      value={{ language: "en", t: mockT, isLoading: false, dir: "ltr", isRtl: false }}
    >
      <SettingsBrandingDraftProvider
        saveSuccessMessage="Saved"
        saveSuccessDescription="Branding saved"
      >
        <TestComponent />
      </SettingsBrandingDraftProvider>
    </TranslationContext.Provider>
  );
}

async function mount(): Promise<{ root: ReturnType<typeof createRoot> }> {
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(<Harness />);
  });
  return { root };
}

describe("useBrandingDraft server-authoritative identity save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBrandingFromServer.mockResolvedValue(serverBranding);
    mockSaveBrandingSettings.mockResolvedValue({ ok: true });
  });

  it("overlays only the edited identity field on the fresh server record", async () => {
    const { root } = await mount();
    expect(draft).not.toBeNull();

    act(() => {
      draft!.upd("city", "Lahore");
      draft!.upd("tagline", "Edited tagline");
    });

    await act(async () => {
      await draft!.handleSaveIdentity({ saveSuccessMessage: "Saved", saveSuccessDescription: "" });
    });

    expect(mockFetchBrandingFromServer).toHaveBeenCalledTimes(1);
    expect(mockSaveBrandingSettings).toHaveBeenCalledTimes(1);
    const saved = mockSaveBrandingSettings.mock.calls[0]![0] as Record<string, unknown>;

    // Edited fields win…
    expect(saved.city).toBe("Lahore");
    expect(saved.tagline).toBe("Edited tagline");
    // …everything the user did not edit comes from the server, so a stale/absent
    // local record can no longer wipe institution details.
    expect(saved.email).toBe("info@alnoor.test");
    expect(saved.legalName).toBe("Al-Noor Education Trust");
    expect(saved.addressLine1).toBe("12 Knowledge Road");
    expect(saved.country).toBe("Pakistan");
    expect(saved.madrasaName).toBe("Al-Noor Academy");
    expect(saved.socialLinks).toEqual([
      { platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" },
    ]);

    act(() => root.unmount());
  });

  it("falls back to the hydrated baseline when the server read fails", async () => {
    mockFetchBrandingFromServer.mockResolvedValue(null);
    const { root } = await mount();

    act(() => {
      draft!.upd("city", "Lahore");
    });
    await act(async () => {
      await draft!.handleSaveIdentity();
    });

    const saved = mockSaveBrandingSettings.mock.calls[0]![0] as Record<string, unknown>;
    expect(saved.city).toBe("Lahore");
    // Local baseline still carries the platform-managed name (read-only in the UI).
    expect(saved.madrasaName).toBe("Local Madrasa");

    act(() => root.unmount());
  });
});
