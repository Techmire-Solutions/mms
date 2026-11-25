import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminsDialogs } from "@/platform/features/users/components/admin/PlatformAdminsDialogs";
import type { PlatformUserProfile } from "@mms/contracts";

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

vi.mock("@/platform/features/users/components/admin/PlatformEditAdminAccessDialog", () => ({
  PlatformEditAdminAccessDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="edit-dialog">Edit Dialog</div> : null,
}));

vi.mock("@/platform/features/users/components/admin/PlatformAdminDangerDialog", () => ({
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
      contacts: false,
      messaging: false,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const dummyDescriptor = {
    getTableColumns: () => [],
  } as unknown as ReturnType<
    typeof import("@/platform/features/users/hooks/usePlatformUserDescriptor").usePlatformUserDescriptor
  >;

  // Radix sheets/dialogs mount portals, which the server renderer cannot handle; render into a
  // DOM and assert on the document (the container holds the component's own, non-portal output).
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderDialogs(node: React.ReactElement): Promise<{ own: string; body: string }> {
    await act(async () => {
      root.render(node);
    });
    return { own: container.innerHTML, body: document.body.innerHTML };
  }

  it("renders nothing when all dialog states are null", async () => {
    const { own, body } = await renderDialogs(
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

    expect(own).toBe("");
    expect(body).not.toContain("Edit Dialog");
  });

  it("renders edit dialog, danger dialog, and detail sheet when active", async () => {
    const { body } = await renderDialogs(
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

    expect(body).toContain("Edit Dialog");
    expect(body).toContain("Danger Mode: delete");
    expect(body).toContain("Admin One");
  });
});
