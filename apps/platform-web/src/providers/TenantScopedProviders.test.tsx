import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TenantScopedProviders from "./TenantScopedProviders";
import { useContactConfig } from "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext";

vi.mock("@/lib/host/useIsTenantHost", () => ({
  useIsTenantHost: vi.fn(),
}));

vi.mock("@/hooks/useTenantDatabaseUpdates", () => ({
  useTenantDatabaseUpdates: vi.fn(),
}));

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: vi.fn(),
  // Mirrors the real module: the optional accessor never throws.
  useOptionalAuth: vi.fn(() => null),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: vi.fn(),
}));

// The bridges bind the app's hooks into the module hosts. They are mounted here (tenant branch) rather
// than in AppProviders so the entry closure stays small; the marker components keep these tests focused
// on provider composition instead of executing the whole hook stack.
vi.mock("@/providers/ContactsHostProvider", () => ({
  ContactsHostBridge: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="contacts-host-bridge">{children}</div>
  ),
}));

vi.mock("@/providers/HasanatHostProvider", () => ({
  HasanatHostBridge: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="hasanat-host-bridge">{children}</div>
  ),
}));

vi.mock("@mms/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/contracts")>();
  return {
    ...actual,
    isInstitutionSetupComplete: vi.fn(),
  };
});

import { useIsTenantHost } from "@/lib/host/useIsTenantHost";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { isInstitutionSetupComplete } from "@mms/contracts";

function TestContactConsumer(): React.JSX.Element {
  const { formTabsReady, fields } = useContactConfig();
  return (
    <div>
      <span data-testid="ready">{String(formTabsReady)}</span>
      <span data-testid="has-basic">{String(Boolean(fields.basic))}</span>
    </div>
  );
}

describe("TenantScopedProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children directly when not on tenant host", () => {
    vi.mocked(useIsTenantHost).mockReturnValue(false);
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      user: null,
      authChecked: true,
    } as ReturnType<typeof useAuth>);

    const html = renderToStaticMarkup(
      <TenantScopedProviders>
        <div data-testid="child">Child Content</div>
      </TenantScopedProviders>,
    );

    expect(html).toContain("Child Content");
    // Host bridges are tenant-only; an apex render must not mount them.
    expect(html).not.toContain("contacts-host-bridge");
    expect(html).not.toContain("hasanat-host-bridge");
  });

  it("mounts ContactConfigProvider on tenant host even when unauthenticated or setup incomplete", () => {
    vi.mocked(useIsTenantHost).mockReturnValue(true);
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      user: null,
      authChecked: true,
    } as ReturnType<typeof useAuth>);
    vi.mocked(isInstitutionSetupComplete).mockReturnValue(false);

    const queryClient = new QueryClient();
    let html = "";
    expect(() => {
      html = renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <TenantScopedProviders>
            <TestContactConsumer />
          </TenantScopedProviders>
        </QueryClientProvider>,
      );
    }).not.toThrow();

    expect(html).toContain("ready");
    expect(html).toContain("true");
    // Module host bridges live inside the tenant branch, wrapping the children.
    expect(html).toContain("contacts-host-bridge");
    expect(html).toContain("hasanat-host-bridge");
  });

  it("useContactConfig gracefully degrades outside provider without throwing", () => {
    let html = "";
    expect(() => {
      html = renderToStaticMarkup(<TestContactConsumer />);
    }).not.toThrow();

    expect(html).toContain("ready");
    expect(html).toContain("true");
  });
});
