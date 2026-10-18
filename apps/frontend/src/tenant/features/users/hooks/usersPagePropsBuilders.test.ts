import { describe, expect, it, vi } from "vitest";
import { buildUsersWorkTierProps } from "./usersPageWorkTierProps";
import { buildUsersModalLayerProps } from "./usersPageModalLayerProps";
import { normalizeWorkspaceUser } from "@mms/shared";

describe("usersPagePropsBuilders", () => {
  it("builds UsersWorkTierProps object from domain slices", () => {
    const mockUser = normalizeWorkspaceUser({
      id: "u1",
      name: "User One",
      email: "u1@test.com",
      role: "admin",
    });

    const mockFilters = {
      listPage: 1,
      setListPage: vi.fn(),
      search: "",
      setSearch: vi.fn(),
      roleFilter: "all",
      setRoleFilter: vi.fn(),
      statusFilter: "all",
      setStatusFilter: vi.fn(),
      selectedIds: ["u1"],
      setSelectedIds: vi.fn(),
      showDeleted: false,
      setShowDeleted: vi.fn(),
    } as unknown as Parameters<typeof buildUsersWorkTierProps>[0]["filters"];

    const mockColumns = {
      getColumnWidth: vi.fn(),
      setColumnWidth: vi.fn(),
      isColumnVisible: vi.fn(() => true),
      columnRegistry: [],
      updateUserColumnLayout: vi.fn(),
      customizerLabels: {},
    } as unknown as Parameters<typeof buildUsersWorkTierProps>[0]["columns"];

    const mockActivityColumns = {
      getColumnWidth: vi.fn(),
      setColumnWidth: vi.fn(),
    } as unknown as Parameters<typeof buildUsersWorkTierProps>[0]["activityColumns"];

    const mockActions = {
      handleDeleteUser: vi.fn(),
      handleRestoreUser: vi.fn(),
      handleBulkDelete: vi.fn(),
      handleBulkRestore: vi.fn(),
    } as unknown as Parameters<typeof buildUsersWorkTierProps>[0]["actions"];

    const workTierProps = buildUsersWorkTierProps({
      tabs: [{ id: "users", label: "Users" }],
      activeSubTab: "users",
      users: [mockUser],
      logs: [],
      filters: mockFilters,
      columns: mockColumns,
      activityColumns: mockActivityColumns,
      actions: mockActions,
      isWorkPageLoading: false,
      isWorkPageFetching: false,
      isLogsLoading: true,
      listLoadFailed: false,
      logsLoadFailed: false,
      canWrite: true,
      canDelete: true,
      onSubTabChange: vi.fn(),
      onRetryUsers: vi.fn(),
      onRetryLogs: vi.fn(),
      onViewUser: vi.fn(),
      onEditUser: vi.fn(),
      onResetPassword: vi.fn(),
      onAddUser: vi.fn(),
      onInviteUser: vi.fn(),
      onMessageUsers: vi.fn(),
    });

    expect(workTierProps.tabs).toEqual([{ id: "users", label: "Users" }]);
    expect(workTierProps.users).toHaveLength(1);
    expect(workTierProps.selectedIds).toEqual(["u1"]);
    expect(workTierProps.isLogsLoading).toBe(true);
  });

  it("builds UsersModalLayerProps object from domain slices", () => {
    const mockActions = {
      handleSaveEdit: vi.fn(),
      handleResetPassword: vi.fn(),
      handleAddUser: vi.fn(),
      handleInvite: vi.fn(),
      handleRestoreUser: vi.fn(),
    } as unknown as Parameters<typeof buildUsersModalLayerProps>[0]["actions"];

    const modalLayerProps = buildUsersModalLayerProps({
      viewing: null,
      editing: null,
      resettingPasswordFor: null,
      showAddUser: true,
      showInvite: false,
      canWrite: true,
      canDelete: true,
      users: [],
      messagingTarget: null,
      actions: mockActions,
      setViewing: vi.fn(),
      setEditing: vi.fn(),
      setResettingPasswordFor: vi.fn(),
      setShowAddUser: vi.fn(),
      setShowInvite: vi.fn(),
      handleOpenEdit: vi.fn(),
      closeComposer: vi.fn(),
    });

    expect(modalLayerProps.showAddUser).toBe(true);
    expect(modalLayerProps.showInvite).toBe(false);
  });
});
