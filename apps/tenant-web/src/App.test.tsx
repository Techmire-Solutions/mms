import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import App from "./App";

const mockUseAuth = vi.fn();
const mockShouldShowOverlay = vi.fn();
const mockApplyAppTheme = vi.fn(() => Promise.resolve());

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/contexts/authErrorOverlay", () => ({
  shouldShowUserNotRegisteredOverlay: (args: unknown) => mockShouldShowOverlay(args),
}));

vi.mock("@mms/fe-core/lib/brandingTheme", () => ({
  applyAppTheme: () => mockApplyAppTheme(),
}));

vi.mock("@/providers/AppProviders", () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-providers">{children}</div>
  ),
}));

vi.mock("@/components/routing/RouterBridge", () => ({
  default: () => <div data-testid="router-bridge" />,
}));

vi.mock("@/tenant/routes/TenantRoutes", () => ({
  default: () => <div data-testid="tenant-routes">TenantRoutes</div>,
}));

vi.mock("@/components/routing/UserNotRegisteredError", () => ({
  default: () => <div data-testid="not-registered">NotRegistered</div>,
}));

vi.mock("@mms/fe-core/components/NetworkStatusIndicator", () => ({
  NetworkStatusIndicator: () => <div data-testid="network-indicator" />,
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

describe("App", () => {
  let rendered: ReturnType<typeof renderApp> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/students");
  });

  afterEach(() => {
    rendered?.cleanup();
    rendered = null;
  });

  it("shows loading fallback while auth is checking protected paths", () => {
    mockUseAuth.mockReturnValue({ isLoadingAuth: true, authChecked: false, authError: null });
    mockShouldShowOverlay.mockReturnValue(false);
    rendered = renderApp();
    expect(rendered.container.textContent).not.toContain("TenantRoutes");
    expect(rendered.container.textContent).not.toContain("NotRegistered");
  });

  it("renders UserNotRegisteredError overlay when flagged", async () => {
    mockUseAuth.mockReturnValue({
      isLoadingAuth: false,
      authChecked: true,
      authError: { type: "user_not_registered" },
    });
    mockShouldShowOverlay.mockReturnValue(true);
    rendered = renderApp();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(rendered.container.textContent).toContain("NotRegistered");
  });

  it("renders routes and applies theme on storage/preview events", async () => {
    mockUseAuth.mockReturnValue({ isLoadingAuth: false, authChecked: true, authError: null });
    mockShouldShowOverlay.mockReturnValue(false);
    rendered = renderApp();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(rendered.container.textContent).toContain("TenantRoutes");
    expect(mockApplyAppTheme).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("local-database-update"));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(mockApplyAppTheme).toHaveBeenCalledTimes(2);
  });
});
