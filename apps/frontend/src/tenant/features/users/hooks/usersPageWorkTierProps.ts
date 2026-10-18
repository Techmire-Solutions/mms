import type { ActivityLog, SystemUser, UsersListPageResult } from "@mms/shared";
import type {
  UsersWorkSubTab,
  UsersWorkTierProps,
} from "@/tenant/features/users/components/UsersWorkTier";
import type { useUsersDirectoryFilters } from "@/tenant/features/users/hooks/useUsersDirectoryFilters";
import type { useUserColumnLayout } from "@/tenant/features/users/hooks/useUserColumnLayout";
import type { useUserActivityColumnLayout } from "@/tenant/features/users/hooks/useUserActivityColumnLayout";
import type { useUsersPageActions } from "@/tenant/features/users/hooks/useUsersPageActions";

export interface BuildUsersWorkTierSource {
  tabs: UsersWorkSubTab[];
  activeSubTab: string;
  users: SystemUser[];
  activityUsers?: SystemUser[];
  logs: ActivityLog[];
  filters: ReturnType<typeof useUsersDirectoryFilters>;
  columns: ReturnType<typeof useUserColumnLayout>;
  activityColumns: ReturnType<typeof useUserActivityColumnLayout>;
  actions: ReturnType<typeof useUsersPageActions>;
  workPageData?: UsersListPageResult;
  isWorkPageLoading: boolean;
  isWorkPageFetching: boolean;
  isLogsLoading?: boolean;
  listLoadFailed: boolean;
  logsLoadFailed: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onSubTabChange: (subTab: string) => void;
  onRetryUsers: () => void;
  onRetryLogs: () => void;
  onViewUser: (user: SystemUser) => void;
  onEditUser: (user: SystemUser) => void;
  onResetPassword: (user: SystemUser) => void;
  onAddUser: () => void;
  onInviteUser: () => void;
  onMessageUsers: (channel: "sms" | "whatsapp" | "email", users: SystemUser[]) => void;
}

/**
 * Assembles standard Work Tier props from controller domain slices.
 */
export function buildUsersWorkTierProps(source: BuildUsersWorkTierSource): UsersWorkTierProps {
  const { filters, columns, activityColumns, actions } = source;

  return {
    tabs: source.tabs,
    activeSubTab: source.activeSubTab,
    users: source.users,
    activityUsers: source.activityUsers,
    workPageData: source.workPageData,
    listPage: filters.listPage,
    onPageChange: filters.setListPage,
    search: filters.search,
    roleFilter: filters.roleFilter,
    statusFilter: filters.statusFilter,
    selectedIds: filters.selectedIds,
    onSelectedIdsChange: filters.setSelectedIds,
    onSearchChange: filters.setSearch,
    onRoleFilterChange: filters.setRoleFilter,
    onStatusFilterChange: filters.setStatusFilter,
    logs: source.logs,
    listLoadFailed: source.listLoadFailed,
    logsLoadFailed: source.logsLoadFailed,
    isWorkPageLoading: source.isWorkPageLoading,
    isWorkPageFetching: source.isWorkPageFetching,
    isLogsLoading: source.isLogsLoading,
    canWrite: source.canWrite,
    canDelete: source.canDelete,
    showDeleted: filters.showDeleted,
    getUserColumnWidth: columns.getColumnWidth,
    setUserColumnWidth: columns.setColumnWidth,
    isUserColumnVisible: columns.isColumnVisible,
    userColumnRegistry: columns.columnRegistry,
    updateUserColumnLayout: columns.updateUserColumnLayout,
    onResetLayout: columns.resetColumnLayout,
    userColumnCustomizerLabels: columns.customizerLabels,
    activityColumnLayout: activityColumns,
    onSubTabChange: source.onSubTabChange,
    onRetryUsers: source.onRetryUsers,
    onRetryLogs: source.onRetryLogs,
    onViewUser: source.onViewUser,
    onEditUser: source.onEditUser,
    onDeleteUser: (id) => {
      void actions.handleDeleteUser(id);
    },
    onRestoreUser: (id) => {
      void actions.handleRestoreUser(id);
    },
    onBulkDeleteUsers: (ids) => {
      void actions.handleBulkDelete(ids);
    },
    onBulkRestoreUsers: (ids) => {
      void actions.handleBulkRestore(ids);
    },
    onResetPassword: source.onResetPassword,
    onAddUser: source.onAddUser,
    onInviteUser: source.onInviteUser,
    onMessageUsers: source.onMessageUsers,
    onToggleDeleted: filters.setShowDeleted,
  };
}
