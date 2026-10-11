import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PlatformDashboardQuickActions } from "./PlatformDashboardQuickActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PlatformDashboardQuickActions Component", () => {
  it("renders quick action buttons based on operator permissions", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformDashboardQuickActions canWorkspaces={true} canSystem={true} canAdmins={true} />
      </MemoryRouter>,
    );

    expect(html).toContain("platform.quickActionsTitle");
    expect(html).toContain("platform.manageMadrasas");
    expect(html).toContain("module.reports");
    expect(html).toContain("platform.activityLogsTitle");
    expect(html).toContain("platform.systemMaintenance");
    expect(html).toContain("platform.adminsTitle");
  });

  it("hides admin and system actions when permissions are restricted", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformDashboardQuickActions canWorkspaces={true} canSystem={false} canAdmins={false} />
      </MemoryRouter>,
    );

    expect(html).toContain("platform.manageMadrasas");
    expect(html).not.toContain("platform.systemMaintenance");
    expect(html).not.toContain("platform.adminsTitle");
  });
});
