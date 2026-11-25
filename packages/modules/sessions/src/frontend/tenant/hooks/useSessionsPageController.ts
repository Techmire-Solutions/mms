import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useWorkDirectoryViewMode } from "@mms/fe-core/tenant";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModuleTierPageNav } from "../host/useModuleTierPageNav";
import type { SessionSortField } from "../lib/sessionPageTypes";
import type { Session } from "../lib/sessionsData";
import { useSessionsPaginated, useSessionMutations } from "./useSessions";
import { useSessionDisplayConfig } from "./useSessionDisplayConfig";
import { useSessionColumnLayout } from "./useSessionColumnLayout";
import { useSessionsDirectoryFilters } from "./useSessionsDirectoryFilters";
import { useSessionsKeyboardShortcuts } from "./useSessionsKeyboardShortcuts";
import { useSessionsDialogs } from "./useSessionsDialogs";
import { useSessionConfig } from "../host/useSessionConfig";
import { SESSIONS_MODULE_MANIFEST, type SessionsListPageResult } from "@mms/contracts";
import { useSessionsPageCrudActions } from "./useSessionsPageCrudActions";
import { defaultSessionsExportColumns, useSessionsExportActions } from "./useSessionsExportActions";
import { useWorkSelection } from "@mms/fe-core/hooks/useWorkSelection";
import { toggleFilterValue } from "./sessionsPageControllerActions";

export function useSessionsPageController() {
  const {
    canWrite,
    canDelete,
    canExport,
    visibleTabs: PAGE_TABS,
    effectiveTab,
    setActiveTab,
  } = useModuleTierPageNav({
    manifest: SESSIONS_MODULE_MANIFEST,
    workLabelKey: "nav.sessions",
    storageKey: "sessions_active_tab",
  });
  const { t } = useTranslation();
  const {
    createSession,
    updateSession,
    deleteSession,
    restoreSession,
    bulkDeleteSessions,
    bulkRestoreSessions,
    bulkUpdateSessionStatus,
  } = useSessionMutations();
  const { types } = useSessionConfig();
  const { statusOptions, typeOptions, statusLabels, typeLabels, statusConfig, typeConfig } =
    useSessionDisplayConfig({ types, t });

  const columnLayout = useSessionColumnLayout();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const directory = useSessionsDirectoryFilters();
  const handleDeleteRef = useRef<(id: string, reason?: string) => void>(() => {});
  const dialogs = useSessionsDialogs((id, reason) => handleDeleteRef.current(id, reason));
  const activeTab = effectiveTab;

  const useServerWork = activeTab === "work";
  const {
    data: workPageData,
    isLoading: isWorkLoading,
    isFetching: isWorkFetching,
    isError: isErrorTsr,
    refetch,
  } = useSessionsPaginated({
    page: directory.listPage,
    limit: SESSIONS_MODULE_MANIFEST.defaultPageSize,
    search: directory.debouncedSearch,
    status: directory.filterStatus.length > 0 ? directory.filterStatus.join(",") : undefined,
    type: directory.filterType.length > 0 ? directory.filterType.join(",") : undefined,
    sortField: directory.sortField,
    sortDir: directory.sortDir,
    includeDeleted: directory.showDeleted,
    enabled: useServerWork,
  });

  const isError = isErrorTsr || (workPageData != null && workPageData.status !== 200);
  const pageData =
    workPageData?.status === 200 ? (workPageData.body as SessionsListPageResult) : undefined;
  const sessions = (pageData?.sessions ?? []) as Session[];

  const { listPage, setListPage } = directory;

  // Deleting the last row of the last page leaves an empty page; clamp back to the real end.
  useEffect(() => {
    if (!pageData) return;
    const lastPage = Math.max(1, Math.ceil(pageData.total / Math.max(1, pageData.limit)));
    if (listPage > lastPage) setListPage(lastPage);
  }, [pageData, listPage, setListPage]);

  const {
    selectedIds,
    setSelectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAll,
    toggleSelected,
    clearSelection,
  } = useWorkSelection(sessions);

  useEffect(() => {
    setSelectedIds([]);
  }, [
    directory.debouncedSearch,
    directory.filterStatus,
    directory.filterType,
    directory.showDeleted,
    directory.sortField,
    directory.sortDir,
    setSelectedIds,
  ]);

  useSessionsKeyboardShortcuts({
    selectedCount: selectedIds.length,
    hasActiveFilters: directory.hasActiveFilters,
    clearFilters: directory.clearFilters,
    clearSelection,
    canWrite,
    showDeleted: directory.showDeleted,
    onCreate: dialogs.openCreateForm,
  });

  const shownCount = pageData?.total ?? sessions.length;

  const crudActions = useSessionsPageCrudActions({
    t,
    editSession: dialogs.editSession,
    detailSession: dialogs.detailSession,
    setDetailSession: dialogs.setDetailSession,
    createSession,
    updateSession,
    deleteSession,
    restoreSession,
    bulkDeleteSessions,
    bulkRestoreSessions,
    bulkUpdateSessionStatus,
    selectedIds,
    setSelectedIds,
  });

  useEffect(() => {
    handleDeleteRef.current = crudActions.handleDelete;
  });

  const { handleExportCSV, handleBulkExport } = useSessionsExportActions({
    tableColumns: defaultSessionsExportColumns(t),
    canExport,
    search: directory.search,
    filterStatus: directory.filterStatus,
    filterType: directory.filterType,
    sortField: directory.sortField,
    sortDir: directory.sortDir,
    viewingDeleted: directory.showDeleted,
    selectedIds,
  });

  const handleSort = (nextSortField: SessionSortField) => {
    if (directory.sortField === nextSortField) {
      directory.setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    directory.setSortField(nextSortField);
    directory.setSortDir("asc");
  };

  const toggleFilter = <T>(
    selectedValues: T[],
    setSelectedValues: Dispatch<SetStateAction<T[]>>,
    nextValue: T,
  ) => toggleFilterValue(selectedValues, setSelectedValues, nextValue);

  const canSelectSessions = canWrite || canDelete;

  return {
    t,
    canWrite,
    canDelete,
    canExport,
    PAGE_TABS,
    activeTab,
    setActiveTab,
    statusOptions,
    typeOptions,
    statusLabels,
    typeLabels,
    viewMode,
    setViewMode,
    columnLayout,
    ...dialogs,
    ...directory,
    workPageData: pageData,
    isError,
    isWorkLoading,
    isWorkFetching,
    useServerWork,
    canSelectSessions,
    selectedIds,
    allVisibleSelected,
    someVisibleSelected,
    statusConfig,
    typeConfig,
    sessions,
    shownCount,
    toggleFilter,
    refetch,
    handleSort,
    toggleSelectAll,
    toggleSelected,
    clearSelection,
    ...crudActions,
    bulkStatusPending: bulkUpdateSessionStatus.isPending,
    handleExportCSV,
    handleBulkExport,
  };
}
