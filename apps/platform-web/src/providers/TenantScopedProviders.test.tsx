import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TenantScopedProviders from "./TenantScopedProviders";
import { useContactConfig } from "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext";

vi.mock("@/lib/host/useIsTenantHost", () => ({
  useIsTenantHost: vi.fn(),
}));

const mockUseTenantDatabaseUpdates = vi.fn();
vi.mock("@/hooks/useTenantDatabaseUpdates", () => ({
  useTenantDatabaseUpdates: () => mockUseTenantDatabaseUpdates(),
}));

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: vi.fn(),
  // Mirrors the real module: the optional accessor never throws.
  useOptionalAuth: vi.fn(() => null),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: vi.fn(),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ dateFormat: "YYYY-MM-DD" }),
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

  it("renders children directly without live-push subscription when not on tenant host", () => {
    vi.mocked(useIsTenantHost).mockReturnValue(false);
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { id: "u1", mustChangePassword: false },
      authChecked: true,
    } as ReturnType<typeof useAuth>);

    const html = renderToStaticMarkup(
      <TenantScopedProviders>
        <div data-testid="child">Child Content</div>
      </TenantScopedProviders>,
    );

    expect(html).toContain("Child Content");
    expect(mockUseTenantDatabaseUpdates).not.toHaveBeenCalled();
  });

  it("subscribes to live push only when authenticated and setup is complete", () => {
    vi.mocked(useIsTenantHost).mockReturnValue(true);
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      user: null,
      authChecked: true,
    } as ReturnType<typeof useAuth>);
    vi.mocked(isInstitutionSetupComplete).mockReturnValue(false);

    renderToStaticMarkup(
      <TenantScopedProviders>
        <div data-testid="child">Unauthenticated Child</div>
      </TenantScopedProviders>,
    );
    expect(mockUseTenantDatabaseUpdates).not.toHaveBeenCalled();

    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { id: "u1", mustChangePassword: false },
      authChecked: true,
    } as ReturnType<typeof useAuth>);
    vi.mocked(isInstitutionSetupComplete).mockReturnValue(true);

    const html = renderToStaticMarkup(
      <TenantScopedProviders>
        <div data-testid="child">Authenticated Child</div>
      </TenantScopedProviders>,
    );
    expect(html).toContain("Authenticated Child");
    expect(mockUseTenantDatabaseUpdates).toHaveBeenCalledTimes(1);
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
