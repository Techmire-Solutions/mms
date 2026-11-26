import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mockApplyApexPlatformTheme = vi.fn();
const mockUnsubscribePlatformBranding = vi.fn();
const mockSubscribePlatformBranding = vi.fn((_cb: () => void) => mockUnsubscribePlatformBranding);

vi.mock("@mms/fe-core/lib/apexPlatformTheme", () => ({
  applyApexPlatformTheme: (lang: string) => mockApplyApexPlatformTheme(lang),
}));

vi.mock("@mms/fe-core/lib/platformBrandingStore", () => ({
  subscribePlatformBranding: (cb: () => void) => mockSubscribePlatformBranding(cb),
}));

vi.mock("@/providers/AppProviders", () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-providers">{children}</div>
  ),
}));

vi.mock("@/providers/MotionPreferences", () => ({
  MotionPreferences: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="motion-preferences">{children}</div>
  ),
}));

vi.mock("@/platform/features/auth/lib/PlatformAuthContext", () => ({
  PlatformAuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="platform-auth-provider">{children}</div>
  ),
}));

vi.mock("@/components/routing/RouterBridge", () => ({
  default: () => <div data-testid="router-bridge" />,
}));

vi.mock("@/platform/routes/ApexRoutes", () => ({
  ApexRoutesWithSuspense: () => <div data-testid="apex-routes">ApexRoutes</div>,
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

  it("mounts PlatformAuthProvider and ApexRoutesWithSuspense and locks theme to English", async () => {
    rendered = renderApp();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(rendered.container.textContent).toContain("ApexRoutes");
    expect(mockApplyApexPlatformTheme).toHaveBeenCalledWith("en");
    expect(mockSubscribePlatformBranding).toHaveBeenCalledTimes(1);
  });

  it("re-applies apex platform theme on storage/preview updates and unsubscribes on unmount", async () => {
    rendered = renderApp();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    await act(async () => {
      window.dispatchEvent(new Event("local-database-update"));
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(mockApplyApexPlatformTheme).toHaveBeenCalledTimes(2);
    rendered.cleanup();
    rendered = null;
    expect(mockUnsubscribePlatformBranding).toHaveBeenCalledTimes(1);
  });
});
