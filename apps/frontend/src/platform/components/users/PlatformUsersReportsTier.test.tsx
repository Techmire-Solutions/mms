import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformUsersReportsTier } from "./PlatformUsersReportsTier";

const mockUsePlatformAdmins = vi.fn();
vi.mock("@/platform/hooks/usePlatformAdmins", () => ({
  usePlatformAdmins: () => mockUsePlatformAdmins(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

describe("PlatformUsersReportsTier", () => {
  it("renders metrics, capabilities, and governance when data loaded", () => {
    mockUsePlatformAdmins.mockReturnValue({
      data: [
        {
          id: "admin-1",
          name: "Zaid",
          email: "zaid@example.com",
          role: "super_user",
          permissions: {
            workspaces: true,
            onboard: true,
            settings: true,
            admins: true,
            system: true,
          },
          emailVerifiedAt: "2026-01-01",
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(<PlatformUsersReportsTier />);
    expect(html).toContain("platform.manageAdmins");
    expect(html).toContain("platform.capabilitiesLabel");
    expect(html).toContain("Role &amp; Security Governance");
  });

  it("renders loading state when loading", () => {
    mockUsePlatformAdmins.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(<PlatformUsersReportsTier />);
    expect(html).toContain("animate-pulse");
  });
});
