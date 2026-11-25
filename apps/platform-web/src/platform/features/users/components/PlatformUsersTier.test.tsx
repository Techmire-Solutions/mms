import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformUsersTier } from "@/platform/features/users/components/PlatformUsersTier";

vi.mock("@/platform/features/users/components/PlatformUsersWorkTier", () => ({
  PlatformUsersWorkTier: () => <div>Work Content</div>,
}));

vi.mock("@/platform/features/users/components/PlatformUsersReportsTier", () => ({
  PlatformUsersReportsTier: () => <div>Reports Content</div>,
}));

vi.mock("@/platform/features/users/components/PlatformUsersSetupTier", () => ({
  PlatformUsersSetupTier: () => <div>Setup Content</div>,
}));

describe("PlatformUsersTier", () => {
  it("renders the work tier for the work tab", () => {
    const html = renderToStaticMarkup(<PlatformUsersTier activeTab="work" />);
    expect(html).toContain("Work Content");
    expect(html).not.toContain("Reports Content");
    expect(html).not.toContain("Setup Content");
  });

  it("renders the reports tier for the reports tab", () => {
    const html = renderToStaticMarkup(<PlatformUsersTier activeTab="reports" />);
    expect(html).toContain("Reports Content");
  });

  it("renders the setup tier for the setup tab", () => {
    const html = renderToStaticMarkup(<PlatformUsersTier activeTab="setup" />);
    expect(html).toContain("Setup Content");
  });
});
