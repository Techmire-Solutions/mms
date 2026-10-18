import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformAdminsToolbar } from "./PlatformAdminsToolbar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        "platform.manageAdmins": "Platform Administrators",
        "platform.searchAdminsPlaceholder": "Search admins…",
        "platform.roleAll": "All",
        "platform.roleSuperUser": "Super Users",
        "platform.roleAdmin": "Admins",
        "platform.exportAdminsCsv": "Export CSV",
        "common.clearFilters": "Clear Filters",
      };
      if (key === "platform.workspaces.shownCount" && params) {
        return `${params.shown} of ${params.total}`;
      }
      return map[key] ?? key;
    },
  }),
}));

describe("PlatformAdminsToolbar", () => {
  it("renders search bar, role tabs, and export button via WorkTaskToolbar", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminsToolbar
        shownCount={5}
        totalCount={10}
        superUserCount={3}
        adminCount={7}
        search=""
        onSearchChange={vi.fn()}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        roleFilter="all"
        onRoleFilterChange={vi.fn()}
        viewMode="table"
        onViewModeChange={vi.fn()}
        onExportCsv={vi.fn()}
      />,
    );

    expect(html).toContain("Platform Administrators");
    expect(html).toContain("Search admins…");
    expect(html).toContain("Export CSV");
    expect(html).toContain("Super Users");
  });
});
