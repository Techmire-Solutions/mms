import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import {
  canAccessRolesAndPermissions,
  normalizeWorkspaceUser,
  USERS_MODULE_MANIFEST,
  type SystemUser,
} from "@mms/shared";
import { useUsersMutations } from "@/tenant/features/users/hooks/useUsersApi";
import { useUsersActivityLogs } from "./useUsersActivityLogs";
import { useUsersPaginated } from "@/tenant/features/users/hooks/useUsersListQueries";
import { useUsersDirectoryFilters } from "@/tenant/features/users/hooks/useUsersDirectoryFilters";
import { useUsersKeyboardShortcuts } from "@/tenant/features/users/hooks/useUsersKeyboardShortcuts";
import { useUsersPageActions } from "@/tenant/features/users/hooks/useUsersPageActions";
import { useUserColumnLayout } from "@/tenant/features/users/hooks/useUserColumnLayout";
import { useUserActivityColumnLayout } from "@/tenant/features/users/hooks/useUserActivityColumnLayout";
import {
  defaultUsersExportColumns,
  useUsersExportActions,
} from "@/tenant/features/users/hooks/useUsersExportActions";
import { useAuth } from "@/lib/contexts/AuthContext";
import { buildUsersWorkTierProps } from "@/tenant/features/users/hooks/usersPageWorkTierProps";
import { useUsersModalLayer } from "./useUsersModalLayer";
import { useUsersTabState } from "./useUsersTabState";

export function useUsersPageController() {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const {
    canWrite,
    canDelete,
    canExport,
    canEditSetup,
    canReports: canViewReports,
    canViewSetup,
  } = useModulePermissions(USERS_MODULE_MANIFEST);
  const canAccessRoles = canAccessRolesAndPermissions(authUser?.role);

  const filters = useUsersDirectoryFilters();
  const { listPage, showDeleted, search, debouncedSearch, roleFilter, statusFilter, selectedIds } =
    filters;

  const {
    USERS_CONFIG_TABS,
    SUB_TABS,
    activeTab,
    setActiveTab,
    activeSubTab,
    setActiveSubTab,
    setConfigSubTab,
    visibleTopTabs,
    effectiveTab,
    effectiveSubTab,
    effectiveConfigTab,
  } = useUsersTabState({
    canAccessRoles,
    canViewSetup,
    canViewReports,
    onResetSelection: filters.clearSelection,
    t,
  });

  const { logs, activityUsers, logsLoadFailed, isLogsLoading, refetchLogs } = useUsersActivityLogs({
    enabled: activeTab === "work" && activeSubTab === "activity",
  });

  const useServerWork = activeTab === "work" && activeSubTab === "users";
  const workPageQuery = useUsersPaginated({
    page: listPage,
    limit: USERS_MODULE_MANIFEST.defaultPageSize,
    search: debouncedSearch,
    role: roleFilter,
    status: statusFilter !== "all" ? statusFilter : undefined,
    includeDeleted: showDeleted,
    enabled: useServerWork,
  });

  const users = ((workPageQuery.data?.users ?? []) as unknown[]).map((user) =>
    normalizeWorkspaceUser(user as Partial<SystemUser> & { roles?: string[]; role?: string }),
  );
  const shownCount = workPageQuery.data?.total ?? users.length;
  const listLoadFailed = workPageQuery.isError;

  const columns = useUserColumnLayout();
  const activityColumns = useUserActivityColumnLayout();

  const { logExportAudit } = useUsersMutations();
  const exportColumns = defaultUsersExportColumns(t);
  const { handleExportCSV } = useUsersExportActions({
    tableColumns: exportColumns,
    canExport,
    search,
    roleFilter,
    statusFilter,
    viewingDeleted: showDeleted,
    selectedIds,
    logExportAudit,
  });

  const actorId = authUser?.id ?? "system";
  const actions = useUsersPageActions({ actorId, t });

  const {
    setViewing,
    setShowInvite,
    setShowAddUser,
    handleOpenEdit,
    handleOpenPasswordReset,
    handleOpenAddUser,
    handleOpenInviteUser,
    handleMessageUsers,
    modalLayerProps,
  } = useUsersModalLayer({
    authUser,
    canWrite,
    canDelete,
    users,
    actions,
    t,
  });

  useUsersKeyboardShortcuts({
    enabled: effectiveTab === "work" && effectiveSubTab === "users",
    selectedCount: selectedIds.length,
    hasActiveFilters: filters.hasActiveFilters,
    clearFilters: filters.clearFilters,
    clearSelection: filters.clearSelection,
    canWrite,
    showDeleted,
    onCreate: () => {
      setShowInvite(false);
      setShowAddUser(true);
    },
  });

  const refetchUsers = () => {
    void workPageQuery.refetch();
  };

  const workTierProps = buildUsersWorkTierProps({
    tabs: SUB_TABS,
    activeSubTab: effectiveSubTab,
    users,
    activityUsers,
    logs,
    filters,
    columns,
    activityColumns,
    actions,
    workPageData: workPageQuery.data,
    isWorkPageLoading: workPageQuery.isLoading,
    isWorkPageFetching: workPageQuery.isFetching,
    isLogsLoading,
    listLoadFailed,
    logsLoadFailed,
    canWrite,
    canDelete,
    onSubTabChange: setActiveSubTab,
    onRetryUsers: refetchUsers,
    onRetryLogs: refetchLogs,
    onViewUser: setViewing,
    onEditUser: handleOpenEdit,
    onResetPassword: handleOpenPasswordReset,
    onAddUser: handleOpenAddUser,
    onInviteUser: handleOpenInviteUser,
    onMessageUsers: handleMessageUsers,
  });

  return {
    t,
    canWrite,
    canExport,
    canEditSetup,
    showDeleted,
    shownCount,
    visibleTopTabs,
    effectiveTab,
    effectiveSubTab,
    setActiveTab,
    USERS_CONFIG_TABS,
    effectiveConfigTab,
    setConfigSubTab,
    handleExportCSV,
    onAddUser: handleOpenAddUser,
    onInviteUser: handleOpenInviteUser,
    refetchUsers,
    refetchLogs,
    workTierProps,
    modalLayerProps,
  };
}
