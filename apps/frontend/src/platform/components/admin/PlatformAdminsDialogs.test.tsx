import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformAdminsDialogs } from "./PlatformAdminsDialogs";
import type { PlatformUserProfile } from "@mms/shared";

vi.mock("@/components/app/DetailDrawerShell", () => ({
  DetailDrawerShell: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children?: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="detail-sheet">
        {title}
        {children}
      </div>
    ) : null,
}));

vi.mock("@/components/app/EntityDescriptorSections", () => ({
  EntityDescriptorSections: () => <span>descriptor-body</span>,
}));

vi.mock("@/platform/components/PlatformEditAdminAccessDialog", () => ({
  PlatformEditAdminAccessDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="edit-dialog">Edit Dialog</div> : null,
}));

vi.mock("@/platform/components/PlatformAdminDangerDialog", () => ({
  PlatformAdminDangerDialog: ({ open, mode }: { open: boolean; mode: string }) =>
    open ? <div data-testid="danger-dialog">Danger Mode: {mode}</div> : null,
}));

describe("PlatformAdminsDialogs", () => {
  const dummyAdmin: PlatformUserProfile = {
    id: "admin-1",
    name: "Admin One",
    email: "admin1@example.com",
    role: "admin",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    disabledAt: null,
    permissions: {
      workspaces: true,
      onboard: false,
      settings: false,
      admins: false,
      system: false,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const dummyDescriptor = {
    getTableColumns: () => [],
  } as unknown as ReturnType<
    typeof import("@/platform/hooks/usePlatformUserDescriptor").usePlatformUserDescriptor
  >;

  it("renders nothing when all dialog states are null", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminsDialogs
        editingAdmin={null}
        onCloseEditing={vi.fn()}
        dangerAdmin={null}
        dangerMode="disable"
        onCloseDanger={vi.fn()}
        inspectAdmin={null}
        onCloseInspect={vi.fn()}
        descriptor={dummyDescriptor}
      />,
    );

    expect(html).toBe("");
  });

  it("renders edit dialog, danger dialog, and detail sheet when active", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminsDialogs
        editingAdmin={dummyAdmin}
        onCloseEditing={vi.fn()}
        dangerAdmin={dummyAdmin}
        dangerMode="delete"
        onCloseDanger={vi.fn()}
        inspectAdmin={dummyAdmin}
        onCloseInspect={vi.fn()}
        descriptor={dummyDescriptor}
      />,
    );

    expect(html).toContain("Edit Dialog");
    expect(html).toContain("Danger Mode: delete");
    expect(html).toContain("Admin One");
  });
});
