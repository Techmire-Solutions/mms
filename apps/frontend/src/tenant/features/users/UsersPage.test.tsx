import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import UsersPage from "./UsersPage";

vi.mock("@/tenant/features/users/hooks/useUsersPageController", () => ({
  useUsersPageController: () => ({
    t: (key: string) => key,
    effectiveTab: "work",
    effectiveSubTab: "users",
    effectiveConfigTab: "preferences",
    visibleTopTabs: [{ id: "work", label: "Users" }],
    USERS_CONFIG_TABS: [],
    canExport: true,
    canWrite: true,
    showDeleted: false,
    shownCount: 5,
    setActiveTab: vi.fn(),
    setConfigSubTab: vi.fn(),
    setShowInvite: vi.fn(),
    setShowAddUser: vi.fn(),
    handleExportCSV: vi.fn(),
    workTierProps: {
      tabs: [{ id: "users", label: "Users" }],
      activeSubTab: "users",
      users: [],
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
      canWrite: true,
      canDelete: true,
      showDeleted: false,
      getUserColumnWidth: vi.fn(),
      setUserColumnWidth: vi.fn(),
      isUserColumnVisible: vi.fn(() => true),
      userColumnRegistry: [],
      updateUserColumnLayout: vi.fn(),
      userColumnCustomizerLabels: {} as unknown as never,
      getActivityColumnWidth: vi.fn(),
      setActivityColumnWidth: vi.fn(),
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
    },
    modalLayerProps: {
      viewing: null,
      editing: null,
      resettingPasswordFor: null,
      showAddUser: false,
      showInvite: false,
      canWrite: true,
      canDelete: true,
      users: [],
      messagingTarget: null,
      onCloseViewing: vi.fn(),
      onCloseEditing: vi.fn(),
      onClosePasswordReset: vi.fn(),
      onCloseAddUser: vi.fn(),
      onCloseInvite: vi.fn(),
      onSaveEdit: vi.fn(),
      onResetPassword: vi.fn(),
      onAddUser: vi.fn(),
      onInvite: vi.fn(),
      onRestoreUser: vi.fn(),
      onEditFromDetail: vi.fn(),
      onCloseComposer: vi.fn(),
    },
  }),
}));

vi.mock("@/tenant/features/users/components/UsersWorkTier", () => ({
  UsersWorkTier: () => <div data-testid="users-work-tier">Users Work Tier Content</div>,
}));

vi.mock("@/tenant/features/users/components/UsersModalLayer", () => ({
  UsersModalLayer: () => <div data-testid="users-modal-layer">Users Modal Layer Content</div>,
}));

vi.mock("@/tenant/features/users/components/UsersCommandMetrics", () => ({
  UsersCommandMetrics: () => <div data-testid="users-command-metrics">Metrics</div>,
}));

describe("UsersPage", () => {
  it("renders page shell with header actions and work tier", () => {
    const html = renderToStaticMarkup(<UsersPage />);
    expect(html).toContain("Users Work Tier Content");
    expect(html).toContain("users.exportCsv");
    expect(html).toContain("users.invite");
    expect(html).toContain("users.add");
  });
});
