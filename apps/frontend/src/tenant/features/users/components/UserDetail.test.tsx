import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { UserDetail } from "./UserDetail";
import { normalizeWorkspaceUser } from "@mms/shared";
import { notify } from "@/lib/notify";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockMutateAsync = vi.fn();

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({
    canManageUser: () => true,
    role: "admin",
  }),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    dateFormat: "YYYY-MM-DD",
    enabledModules: ["users"],
  }),
}));

vi.mock("@/tenant/hooks/useWorkspaceRoles", () => ({
  useWorkspaceRoles: () => [{ id: "admin", name: "Admin", permissions: {} }],
}));

vi.mock("@/tenant/hooks/collections/users", () => ({
  useUsersContractVerifyEmail: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/components/app/DetailDrawerShell", () => ({
  DetailDrawerShell: ({
    title,
    subtitle,
    headerActions,
    children,
  }: {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    headerActions?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div data-testid="detail-drawer">
      <h2>{title}</h2>
      <h3>{subtitle}</h3>
      <div data-testid="header-actions">{headerActions}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/DetailDrawerArchiveChrome", () => ({
  DetailDrawerArchivedBanner: ({ deletedAt }: { deletedAt?: React.ReactNode }) => (
    <div data-testid="archived-banner">Archived at: {deletedAt}</div>
  ),
  DetailDrawerRestoreOrEditAction: ({
    isArchived,
    onRestore,
    onEdit,
  }: {
    isArchived?: boolean;
    onRestore?: () => void;
    onEdit?: () => void;
  }) => (
    <div data-testid="restore-edit-actions">
      {isArchived && onRestore && (
        <button data-testid="restore-btn" onClick={onRestore}>
          Restore
        </button>
      )}
      {!isArchived && onEdit && (
        <button data-testid="edit-btn" onClick={onEdit}>
          Edit
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/tenant/features/users/components/UserBadges", () => ({
  UserRoleBadge: ({ roleId }: { roleId?: React.ReactNode }) => (
    <span data-testid="role-badge">{roleId}</span>
  ),
  UserStatusBadge: ({ status }: { status?: React.ReactNode }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock("@/tenant/features/users/components/UserDetailSections", () => ({
  UserDetailSections: ({ onVerifyEmail }: { onVerifyEmail?: () => void }) => (
    <div data-testid="user-detail-sections">
      <button data-testid="verify-email-btn" onClick={onVerifyEmail}>
        Verify Email
      </button>
    </div>
  ),
}));

describe("UserDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders active user information and edit action", () => {
    const user = normalizeWorkspaceUser({
      id: "u1",
      name: "Active User",
      email: "active@test.com",
      role: "admin",
      status: "active",
    });
    const onEdit = vi.fn();
    const onClose = vi.fn();

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<UserDetail user={user} onClose={onClose} onEdit={onEdit} />);
    });

    expect(container.textContent).toContain("Active User");
    expect(container.textContent).toContain("active@test.com");
    expect(container.querySelector('[data-testid="archived-banner"]')).toBeNull();

    const editBtn = container.querySelector('[data-testid="edit-btn"]');
    expect(editBtn).not.toBeNull();
    act(() => {
      editBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onEdit).toHaveBeenCalledWith(user);

    act(() => {
      root.unmount();
    });
  });

  it("renders archived user banner and restore action", () => {
    const user = normalizeWorkspaceUser({
      id: "u2",
      name: "Archived User",
      email: "archived@test.com",
      role: "admin",
      status: "suspended",
      deletedAt: "2026-09-01T12:00:00Z",
    });
    const onRestore = vi.fn();
    const onClose = vi.fn();

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <UserDetail user={user} onClose={onClose} canDelete={true} onRestore={onRestore} />,
      );
    });

    expect(container.querySelector('[data-testid="archived-banner"]')).not.toBeNull();
    const restoreBtn = container.querySelector('[data-testid="restore-btn"]');
    expect(restoreBtn).not.toBeNull();
    act(() => {
      restoreBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRestore).toHaveBeenCalledWith("u2");

    act(() => {
      root.unmount();
    });
  });

  it("handles email verification mutation and displays success notification", async () => {
    const user = normalizeWorkspaceUser({
      id: "u3",
      name: "Email User",
      email: "email@test.com",
      role: "admin",
      status: "active",
    });
    mockMutateAsync.mockResolvedValueOnce({});

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<UserDetail user={user} onClose={vi.fn()} />);
    });

    const verifyBtn = container.querySelector('[data-testid="verify-email-btn"]');
    await act(async () => {
      verifyBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      params: { id: "u3" },
      body: {},
    });
    expect(notify.success).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });
});
