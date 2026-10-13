import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { formatDate } from "@mms/shared";
import { ModuleWorkListStateShell } from "@/components/app/ModuleWorkListStateShell";
import { UsersListContent } from "@/tenant/features/users/components/UsersListContent";
import { UsersListFilters } from "@/tenant/features/users/components/UsersListFilters";
import { UsersBulkActionBar } from "@/tenant/features/users/components/UsersBulkActionBar";
import {
  getDirectoryPageSelection,
  toggleIdInSelection,
  togglePageIdsInSelection,
} from "@/lib/directorySelection";

import type { UsersListProps } from "@/tenant/features/users/hooks/usersListTypes";
export type { UsersListProps };

export function UsersList({
  users,
  workPageData,
  listPage,
  onPageChange,
  search,
  roleFilter,
  statusFilter,
  selectedIds,
  onSelectedIdsChange,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  onResetPassword,
  onAddUser,
  onInviteUser: _onInviteUser,
  onMessage,
  canWrite = true,
  canDelete = true,
  showDeleted = false,
  onToggleDeleted,
  isLoading = false,
  isError = false,
  isFetching = false,
  onRetry,
  getColumnWidth,
  onColumnResize,
  isColumnVisible,
  columnRegistry,
  updateUserColumnLayout,
  onResetLayout,
  customizerLabels,
}: UsersListProps): React.JSX.Element {
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const { t } = useTranslation();
  const globalSettings = useGlobalSettings();
  const workspaceRoles = useWorkspaceRoles();

  const pageIds = users.map((user) => user.id);
  const { allSelected, someSelected } = getDirectoryPageSelection(pageIds, selectedIds);

  const toggleSelect = (id: string): void =>
    onSelectedIdsChange(toggleIdInSelection(selectedIds, id));
  const toggleAll = (): void => onSelectedIdsChange(togglePageIdsInSelection(selectedIds, pageIds));

  const fmtDate = (ts: string): string => {
    if (!ts) return t("users.never");
    return formatDate(ts, globalSettings.dateFormat, false);
  };

  const selectedSet = new Set(selectedIds);
  const selectedUsers = (() => users.filter((user) => selectedSet.has(user.id)))();

  const pageData = workPageData
    ? {
        page: workPageData.page ?? listPage,
        total: workPageData.total,
        limit: workPageData.limit,
        hasMore: workPageData.hasMore,
      }
    : undefined;

  return (
    <div className="space-y-4">
      <UsersListFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        workspaceRoles={workspaceRoles}
        canDelete={canDelete}
        showDeleted={showDeleted}
        onSearchChange={onSearchChange}
        onRoleFilterChange={onRoleFilterChange}
        onStatusFilterChange={onStatusFilterChange}
        onToggleDeleted={onToggleDeleted}
        onClearSelection={() => onSelectedIdsChange([])}
        columnRegistry={columnRegistry}
        updateUserColumnLayout={updateUserColumnLayout}
        onResetLayout={onResetLayout}
        customizerLabels={customizerLabels}
      />

      <UsersBulkActionBar
        selectedIds={selectedIds}
        selectedUsers={selectedUsers}
        showDeleted={showDeleted}
        canDelete={canDelete}
        onMessage={onMessage}
        onBulkDelete={onBulkDelete}
        onBulkRestore={onBulkRestore}
        onClearSelection={() => onSelectedIdsChange([])}
      />

      <ModuleWorkListStateShell
        isError={isError}
        isLoading={isLoading}
        isFetching={isFetching}
        onRetry={() => onRetry?.()}
        errorTitle={t("users.loadFailed")}
        errorHint={t("users.loadFailedHint")}
        viewMode={viewMode}
        skeletonColumnCount={columnRegistry?.length ?? 6}
        useServerWork
        pageData={pageData}
        onPageChange={onPageChange}
        i18nNamespace="users"
        showPagination={users.length > 0}
        loadingLabel={t("common.loading")}
      >
        <UsersListContent
          viewMode={viewMode}
          users={users}
          selectedIds={selectedIds}
          allSelected={allSelected}
          someSelected={someSelected}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          search={search}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          onAddUser={onAddUser}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          formatLoginDate={fmtDate}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onResetPassword={onResetPassword}
          getColumnWidth={getColumnWidth}
          onColumnResize={onColumnResize}
          isColumnVisible={isColumnVisible}
        />
      </ModuleWorkListStateShell>
    </div>
  );
}
