import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { UsersWorkTier, type UsersWorkTierProps } from "./UsersWorkTier";
import { normalizeWorkspaceUser } from "@mms/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/tenant/features/users/components/UsersList", () => ({
  UsersList: ({
    users,
    onPageChange,
  }: {
    users: unknown[];
    onPageChange: (page: number) => void;
  }) => (
    <div data-testid="users-list">
      <span>Users Count: {users.length}</span>
      <button onClick={() => onPageChange(2)}>Next Page</button>
    </div>
  ),
}));

vi.mock("@/tenant/features/users/components/ActivityLogs", () => ({
  ActivityLogs: ({ logs }: { logs: unknown[] }) => (
    <div data-testid="activity-logs">
      <span>Logs Count: {logs.length}</span>
    </div>
  ),
}));


vi.mock("@/components/app/ErrorState", () => ({
  ErrorState: ({ title, onRetry }: { title?: React.ReactNode; onRetry?: () => void }) => (
    <div data-testid="error-state">
      <span>{title}</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

describe("UsersWorkTier", () => {
  const baseProps: UsersWorkTierProps = {
    tabs: [
      { id: "users", label: "Users" },
      { id: "activity", label: "Activity" },
    ],
    activeSubTab: "users",
    users: [
      normalizeWorkspaceUser({ id: "u1", name: "User 1", email: "u1@test.com", role: "admin" }),
    ],
    listPage: 1,
    onPageChange: vi.fn(),
    search: "",
    roleFilter: "all",
    statusFilter: "all",
    selectedIds: [],
    onSelectedIdsChange: vi.fn(),
    onSearchChange: vi.fn(),
    onRoleFilterChange: vi.fn(),
    onStatusFilterChange: vi.fn(),
    logs: [],
    listLoadFailed: false,
    logsLoadFailed: false,
    isWorkPageLoading: false,
    isWorkPageFetching: false,
    isLogsLoading: false,
    canWrite: true,
    canDelete: true,
    showDeleted: false,
    getUserColumnWidth: vi.fn(),
    setUserColumnWidth: vi.fn(),
    isUserColumnVisible: vi.fn(() => true),
    userColumnRegistry: [],
    updateUserColumnLayout: vi.fn(),
    userColumnCustomizerLabels: {} as unknown as never,
    onSubTabChange: vi.fn(),
    onRetryUsers: vi.fn(),
    onRetryLogs: vi.fn(),
    onViewUser: vi.fn(),
    onEditUser: vi.fn(),
    onDeleteUser: vi.fn(),
    onRestoreUser: vi.fn(),
    onBulkDeleteUsers: vi.fn(),
    onBulkRestoreUsers: vi.fn(),
    onResetPassword: vi.fn(),
    onAddUser: vi.fn(),
    onInviteUser: vi.fn(),
    onMessageUsers: vi.fn(),
    onToggleDeleted: vi.fn(),
  };

  it('renders UsersList when activeSubTab is "users"', () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<UsersWorkTier {...baseProps} activeSubTab="users" />);
    });

    expect(container.querySelector('[data-testid="users-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="activity-logs"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it('renders ActivityLogs when activeSubTab is "activity"', () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <UsersWorkTier
          {...baseProps}
          activeSubTab="activity"
          logs={[{ id: "log-1", action: "create", timestamp: "2026-09-01" } as unknown as never]}
        />,
      );
    });

    expect(container.querySelector('[data-testid="activity-logs"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="users-list"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it('renders CardSkeleton when activeSubTab is "activity" and isLogsLoading is true', () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<UsersWorkTier {...baseProps} activeSubTab="activity" isLogsLoading={true} />);
    });

    expect(container.querySelector('[data-testid="card-skeleton"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="activity-logs"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it('renders ErrorState when activeSubTab is "activity" and logsLoadFailed is true', () => {
    const onRetryLogs = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <UsersWorkTier
          {...baseProps}
          activeSubTab="activity"
          logsLoadFailed={true}
          onRetryLogs={onRetryLogs}
        />,
      );
    });

    expect(container.querySelector('[data-testid="error-state"]')).not.toBeNull();
    const retryBtn = container.querySelector('[data-testid="error-state"] button');
    act(() => {
      retryBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRetryLogs).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });
});
