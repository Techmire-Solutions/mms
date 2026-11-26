import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TenantRoutes from "./TenantRoutes";

const mockUseTenant = vi.fn();
const mockRefetchWorkspace = vi.fn();

vi.mock("@mms/fe-core/tenant", () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mms/fe-core/config/tenantConfig", () => ({
  apexUrl: (path: string) => `http://localhost:5174${path}`,
}));

vi.mock("@/providers/TenantScopedProviders", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tenant-scoped">{children}</div>
  ),
}));

vi.mock("@/components/entry", () => ({
  AuthPageFrame: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-frame">{children}</div>
  ),
}));

vi.mock("@/tenant/components/WorkspaceDisabledScreen", () => ({
  default: ({ subdomain }: { subdomain: string }) => (
    <div data-testid="disabled-screen">Disabled: {subdomain}</div>
  ),
}));

vi.mock("@/tenant/pages/apply/OpenRegistrationsPage", () => ({
  default: () => <div data-testid="open-registrations">Apply</div>,
}));

vi.mock("@/tenant/components/guards/ProtectedRoute", () => ({
  default: () => <div data-testid="protected-route" />,
}));

vi.mock("@/tenant/components/guards/GuestRoute", () => ({
  default: () => <div data-testid="guest-route" />,
}));

function renderRoutes(initialPath: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <TenantRoutes />
      </MemoryRouter>,
    );
  });
  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("TenantRoutes & TenantBootGate", () => {
  let rendered: ReturnType<typeof renderRoutes> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    rendered?.cleanup();
    rendered = null;
  });

  it("shows loading fallback while workspace is loading", async () => {
    mockUseTenant.mockReturnValue({
      workspaceLoading: true,
      workspaceMissing: false,
      workspaceLookupFailed: false,
      workspace: null,
      subdomain: "noor",
      refetchWorkspace: mockRefetchWorkspace,
    });
    rendered = renderRoutes("/login");
    await act(async () => {
      await Promise.resolve();
    });
    expect(rendered.container.textContent).not.toContain("Apply");
  });

  it("renders lookup failure state and retries when requested", async () => {
    mockUseTenant.mockReturnValue({
      workspaceLoading: false,
      workspaceMissing: false,
      workspaceLookupFailed: true,
      workspace: null,
      subdomain: "noor",
      refetchWorkspace: mockRefetchWorkspace,
    });
    rendered = renderRoutes("/login");
    await act(async () => {
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain("errors.boundary.title");
    const retryBtn = rendered.container.querySelector("button");
    expect(retryBtn).not.toBeNull();
    act(() => {
      retryBtn!.click();
    });
    expect(mockRefetchWorkspace).toHaveBeenCalledTimes(1);
  });

  it("renders disabled workspace screen when workspace is disabled on root", async () => {
    mockUseTenant.mockReturnValue({
      workspaceLoading: false,
      workspaceMissing: false,
      workspaceLookupFailed: false,
      workspace: { madrasaName: "Noor", subdomain: "noor", enabled: false },
      subdomain: "noor",
      refetchWorkspace: mockRefetchWorkspace,
    });
    rendered = renderRoutes("/");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(rendered.container.textContent).toContain("Disabled: noor");
  });

  it("redirects missing workspaces to apex and renders routes when active", async () => {
    mockUseTenant.mockReturnValue({
      workspaceLoading: false,
      workspaceMissing: true,
      workspaceLookupFailed: false,
      workspace: null,
      subdomain: "missing",
      refetchWorkspace: mockRefetchWorkspace,
    });
    rendered = renderRoutes("/login");
    await act(async () => {
      await Promise.resolve();
    });
    rendered.cleanup();

    mockUseTenant.mockReturnValue({
      workspaceLoading: false,
      workspaceMissing: false,
      workspaceLookupFailed: false,
      workspace: { madrasaName: "Noor", subdomain: "noor", enabled: true },
      subdomain: "noor",
      refetchWorkspace: mockRefetchWorkspace,
    });
    rendered = renderRoutes("/apply");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(rendered.container.textContent).toContain("Apply");
  });
});
