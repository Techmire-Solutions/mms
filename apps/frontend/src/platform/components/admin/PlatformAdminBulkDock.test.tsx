import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlatformUserProfile } from "@mms/shared";
import { PlatformAdminBulkDock } from "./PlatformAdminBulkDock";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "platform.workspaces.selectedCount" && params) {
        return `${params.count} selected`;
      }
      const map: Record<string, string> = {
        "common.deselect": "Deselect",
        "platform.workspaces.exportSelected": "Export Selected",
        "platform.enableAdminConfirm": "Enable Admins",
        "platform.disableAdminConfirm": "Disable Admins",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockAdmins: PlatformUserProfile[] = [
  {
    id: "admin-1",
    name: "Admin One",
    email: "one@platform.local",
    role: "admin",
    permissions: {
      workspaces: true,
      onboard: false,
      settings: false,
      admins: false,
      system: false,
    },
    disabledAt: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
];

describe("PlatformAdminBulkDock", () => {
  it("renders nothing when selectedCount is 0", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminBulkDock
        selectedCount={0}
        selectedAdmins={[]}
        onClearSelection={vi.fn()}
        onBulkExport={vi.fn()}
      />,
    );
    expect(html).toBe("");
  });

  it("renders selection count and bulk actions when items are selected", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminBulkDock
        selectedCount={1}
        selectedAdmins={mockAdmins}
        onClearSelection={vi.fn()}
        onBulkExport={vi.fn()}
        onBulkEnable={vi.fn()}
        onBulkDisable={vi.fn()}
      />,
    );
    expect(html).toContain("1 selected");
    expect(html).toContain("Export Selected");
    expect(html).toContain("Enable Admins");
    expect(html).toContain("Disable Admins");
  });
});
