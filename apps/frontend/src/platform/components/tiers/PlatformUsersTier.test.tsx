import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformUsersTier } from "./PlatformUsersTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/platform/components/users/PlatformUsersWorkTier", () => ({
  PlatformUsersWorkTier: () => <div data-testid="users-work-tier">Work Content</div>,
}));

vi.mock("@/platform/components/users/PlatformUsersReportsTier", () => ({
  PlatformUsersReportsTier: () => <div data-testid="users-reports-tier">Reports Content</div>,
}));

vi.mock("@/platform/components/users/PlatformUsersSetupTier", () => ({
  PlatformUsersSetupTier: () => <div data-testid="users-setup-tier">Setup Content</div>,
}));

describe("PlatformUsersTier", () => {
  it("renders subtabs with Work, Reports, and Setup", () => {
    const html = renderToStaticMarkup(
      <PlatformUsersTier activeSubTab="work" onSubTabChange={vi.fn()} />,
    );

    expect(html).toContain("module.work");
    expect(html).toContain("module.reports");
    expect(html).toContain("module.setup");
    expect(html).toContain("Work Content");
  });

  it("renders reports content when activeSubTab is reports", () => {
    const html = renderToStaticMarkup(
      <PlatformUsersTier activeSubTab="reports" onSubTabChange={vi.fn()} />,
    );

    expect(html).toContain("Reports Content");
  });

  it("renders setup content when activeSubTab is setup", () => {
    const html = renderToStaticMarkup(
      <PlatformUsersTier activeSubTab="setup" onSubTabChange={vi.fn()} />,
    );

    expect(html).toContain("Setup Content");
  });

  it("hides subtab bar when showSubTabBar is false", () => {
    const html = renderToStaticMarkup(
      <PlatformUsersTier activeSubTab="work" showSubTabBar={false} />,
    );

    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("Work Content");
  });
});
