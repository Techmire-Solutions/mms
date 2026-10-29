import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TenantScopedProviders from "./TenantScopedProviders";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";

vi.mock("@/lib/host/useIsTenantHost", () => ({
  useIsTenantHost: vi.fn(),
}));

vi.mock("@/hooks/useTenantDatabaseUpdates", () => ({
  useTenantDatabaseUpdates: vi.fn(),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
  // Mirrors the real module: the optional accessor never throws.
  useOptionalAuth: vi.fn(() => null),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: vi.fn(),
}));

vi.mock("@mms/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/shared")>();
  return {
    ...actual,
    isInstitutionSetupComplete: vi.fn(),
  };
});

import { useIsTenantHost } from "@/lib/host/useIsTenantHost";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isInstitutionSetupComplete } from "@mms/shared";

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
