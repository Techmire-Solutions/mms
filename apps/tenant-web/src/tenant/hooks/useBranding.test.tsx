import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DEFAULT_BRANDING_SETTINGS, type BrandingSettings } from "@mms/contracts";
import { SETTINGS_PREVIEW_EVENT } from "@mms/fe-core/lib/settingsPreview";

const baseBranding: BrandingSettings = {
  ...DEFAULT_BRANDING_SETTINGS,
  madrasaName: "Darul Uloom",
  tagline: "Knowledge",
  logoUrl: "https://cdn.example/logo.png",
  faviconUrl: "https://cdn.example/fav.ico",
  primaryColor: "#0f766e",
  secondaryColor: "#ca8a04",
  cornerStyle: "rounded",
  email: "info@example.org",
  phone: "03001234567",
  website: "https://example.org",
  addressLine1: "1 Main St",
  city: "Lahore",
  postalCode: "54000",
  country: "Pakistan",
};

const mocks = vi.hoisted(() => ({
  pathname: "/dashboard",
  tenantHost: true,
  entryPath: false,
  branding: null as BrandingSettings | null,
  applyAppTheme: vi.fn(),
  applyPlatformDocumentFavicon: vi.fn(),
  applyTenantDocumentFavicon: vi.fn(),
  platformListener: null as (() => void) | null,
  unsubscribePlatform: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: mocks.pathname }),
}));

vi.mock("@mms/fe-core/lib/brandingTheme", () => ({
  applyAppTheme: () => mocks.applyAppTheme(),
}));

vi.mock("@mms/fe-core/lib/settingsPreviewStore", () => ({
  getScopedBrandingSettings: () => ({ ...(mocks.branding ?? baseBranding) }),
}));

vi.mock("@mms/fe-core/lib/platformBrandingStore", () => ({
  subscribePlatformBranding: (cb: () => void) => {
    mocks.platformListener = cb;
    return mocks.unsubscribePlatform;
  },
}));

vi.mock("@mms/fe-core/config/tenantConfig", () => ({
  isTenantHost: () => mocks.tenantHost,
}));

vi.mock("@mms/fe-core/config/routes", () => ({
  ROUTES: {
    dashboard: "/dashboard",
    students: "/students",
    hasanatCards: "/hasanat-cards",
    questionBank: "/question-bank",
  },
  isEntryPath: () => mocks.entryPath,
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => `tr:${key}` }),
}));

vi.mock("@/lib/documentFavicon", () => ({
  applyPlatformDocumentFavicon: (arg: unknown) => mocks.applyPlatformDocumentFavicon(arg),
  applyTenantDocumentFavicon: (arg: unknown) => mocks.applyTenantDocumentFavicon(arg),
}));

import { useBranding } from "./useBranding";

describe("useBranding", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/dashboard";
    mocks.tenantHost = true;
    mocks.entryPath = false;
    mocks.branding = { ...baseBranding };
    document.title = "Initial";
  });

  function mount(): BrandingSettings {
    let latest: BrandingSettings = baseBranding;
    function Probe() {
      latest = useBranding();
      return null;
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(<Probe />);
    });
    return latest;
  }

  function unmount(): void {
    if (root) act(() => root!.unmount());
    container?.remove();
    root = null;
    container = null;
  }

  it("memoizes identical snapshots, subscribes to store events, and cleans up on unmount", () => {
    const first = mount();
    expect(first.madrasaName).toBe("Darul Uloom");
    expect(mocks.applyAppTheme).toHaveBeenCalledTimes(1);
    expect(document.title).toBe("tr:nav.dashboard | Darul Uloom");
    expect(mocks.applyTenantDocumentFavicon).toHaveBeenCalledTimes(1);

    // Dispatching an update with unchanged serialized payload reuses cachedSnapshot
    act(() => {
      window.dispatchEvent(new Event("local-database-update"));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event(SETTINGS_PREVIEW_EVENT));
      mocks.platformListener?.();
    });

    // Mutating branding triggers a new snapshot and re-runs effects
    mocks.branding = { ...baseBranding, primaryColor: "#1d4ed8", madrasaName: "" };
    act(() => {
      window.dispatchEvent(new Event("local-database-update"));
    });
    expect(mocks.applyAppTheme).toHaveBeenCalledTimes(2);

    unmount();
    expect(mocks.unsubscribePlatform).toHaveBeenCalledTimes(1);
  });

  it("skips title and favicon updates on public entry paths", () => {
    mocks.entryPath = true;
    mount();
    expect(document.title).toBe("Initial");
    expect(mocks.applyTenantDocumentFavicon).not.toHaveBeenCalled();
    expect(mocks.applyPlatformDocumentFavicon).not.toHaveBeenCalled();
    unmount();
  });

  it("formats root, special route keys, and unmatched tenant routes accurately", () => {
    mocks.pathname = "/";
    mount();
    expect(document.title).toBe("tr:nav.dashboard | Darul Uloom");
    unmount();

    mocks.pathname = "/hasanat-cards";
    mount();
    expect(document.title).toBe("tr:nav.hasanatCards | Darul Uloom");
    unmount();

    mocks.pathname = "/question-bank";
    mount();
    expect(document.title).toBe("tr:nav.questionBank | Darul Uloom");
    unmount();

    mocks.pathname = "/unknown-sub-route";
    mount();
    expect(document.title).toBe("Darul Uloom - tr:entry.productName");
    unmount();
  });

  it("applies platform document title and favicon when running on apex host", () => {
    mocks.tenantHost = false;
    mocks.pathname = "/students";
    mocks.branding = { ...baseBranding, madrasaName: "   " };
    mount();
    expect(document.title).toBe("tr:nav.students | tr:entry.productName");
    expect(mocks.applyPlatformDocumentFavicon).toHaveBeenCalledWith(
      expect.objectContaining({ productName: "tr:entry.productName" }),
    );
    unmount();

    mocks.pathname = "/unmatched";
    mocks.branding = { ...baseBranding, madrasaName: "MMS Cloud" };
    mount();
    expect(document.title).toBe("MMS Cloud");
    unmount();
  });
});
