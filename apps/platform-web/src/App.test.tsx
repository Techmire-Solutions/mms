import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTranslation } from "@mms/fe-core/i18n";
import { useTenant } from "@/lib/contexts/TenantContext";
import App from "./App";

const mockApplyApexPlatformTheme = vi.fn();
const mockUnsubscribePlatformBranding = vi.fn();
const mockSubscribePlatformBranding = vi.fn((_cb: () => void) => {
  void _cb;
  return mockUnsubscribePlatformBranding;
});

vi.mock("@mms/fe-core/lib/apexPlatformTheme", () => ({
  applyApexPlatformTheme: (lang: string) => mockApplyApexPlatformTheme(lang),
}));

vi.mock("@mms/fe-core/lib/platformBrandingStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/fe-core/lib/platformBrandingStore")>();
  return {
    ...actual,
    subscribePlatformBranding: (cb: () => void) => mockSubscribePlatformBranding(cb),
  };
});

vi.mock("@/platform/features/auth/lib/PlatformAuthContext", () => ({
  PlatformAuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="platform-auth-provider">{children}</div>
  ),
}));

vi.mock("@/platform/routes/ApexRoutes", () => ({
  ApexRoutesWithSuspense: function RealContextConsumerProbe() {
    const { isApex } = useTenant();
    const { t } = useTranslation();
    const location = useLocation();
    const qc = useQueryClient();
    return (
      <div data-testid="apex-routes">
        ApexRoutes:{String(isApex)}:{location.pathname}:{String(Boolean(qc))}:{t("common.cancel")}
      </div>
    );
  },
}));

function renderApp() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(<App />);
  });
  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("Platform App", () => {
  let rendered: ReturnType<typeof renderApp> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/platform/login");
  });

  afterEach(() => {
    rendered?.cleanup();
    rendered = null;
  });

  it("mounts real PlatformProviders (Tenant, Router, QueryClient, i18n) and locks theme to English", async () => {
    rendered = renderApp();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(rendered.container.textContent).toContain("ApexRoutes:true:/platform/login:true:Cancel");
    expect(mockApplyApexPlatformTheme).toHaveBeenCalledWith("en");
    expect(mockSubscribePlatformBranding).toHaveBeenCalled();
  });

  it("re-applies apex platform theme on storage/preview updates and unsubscribes on unmount", async () => {
    rendered = renderApp();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    mockApplyApexPlatformTheme.mockClear();
    await act(async () => {
      window.dispatchEvent(new Event("local-database-update"));
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(mockApplyApexPlatformTheme).toHaveBeenCalledTimes(1);
    rendered.cleanup();
    rendered = null;
    expect(mockUnsubscribePlatformBranding).toHaveBeenCalled();
  });
});
