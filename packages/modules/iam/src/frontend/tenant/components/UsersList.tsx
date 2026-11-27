import React, { useState } from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { useWorkDirectoryViewMode } from "@mms/fe-core/tenant";
import { useGlobalSettings } from "../host/useGlobalSettings";
import { useWorkspaceRoles } from "../host/useWorkspaceRoles";
import { formatDate } from "@mms/contracts";
import { ModuleWorkListStateShell } from "@mms/fe-core/components/ModuleWorkListStateShell";
import { UsersListContent } from "./UsersListContent";
import { UsersListFilters } from "./UsersListFilters";
import { UsersBulkActionBar } from "./UsersBulkActionBar";
import {
  getDirectoryPageSelection,
  toggleIdInSelection,
  togglePageIdsInSelection,
} from "@mms/fe-core/lib/directorySelection";

import type { UsersListProps } from "../hooks/usersListTypes";
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
  // Selection survives page changes, so the row objects must too. Intersecting the
  // current page with `selectedIds` silently dropped recipients chosen on an earlier
  // page from the bulk message while the bar still reported them as selected.
  // Snapshots are synced with the render-adjust pattern (previous value kept in
  // state, compared conditionally — https://react.dev/reference/react/useState) so
  // render stays free of ref reads/writes (react-hooks/refs).
  const [selectedUserSnapshots, setSelectedUserSnapshots] = useState(
    () => new Map<string, (typeof users)[number]>(),
  );
  const [prevSnapshotSync, setPrevSnapshotSync] = useState(() => ({ selectedIds, users }));
  if (prevSnapshotSync.selectedIds !== selectedIds || prevSnapshotSync.users !== users) {
    setPrevSnapshotSync({ selectedIds, users });
    setSelectedUserSnapshots((previous) => {
      const next = new Map<string, (typeof users)[number]>();
      for (const id of selectedIds) {
        const existing = previous.get(id);
        if (existing) next.set(id, existing);
      }
      for (const user of users) {
        if (selectedSet.has(user.id)) next.set(user.id, user);
      }
      return next;
    });
  }
  const selectedUsers = [...selectedSet]
    .map((id: string) => selectedUserSnapshots.get(id))
    .filter((user): user is (typeof users)[number] => Boolean(user));

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
