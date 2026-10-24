import { useEffect } from "react";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useTranslation } from "@/hooks/useTranslation";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import type { SessionSortField } from "@/tenant/features/sessions/lib/sessionPageTypes";
import type { Session } from "@/lib/data/sessionsData";
import {
  useSessionsPaginated,
  useSessionMutations,
} from "@/tenant/features/sessions/hooks/useSessions";
import { useSessionDisplayConfig } from "@/tenant/features/sessions/hooks/useSessionDisplayConfig";
import { useSessionColumnLayout } from "@/tenant/features/sessions/hooks/useSessionColumnLayout";
import { useSessionsDirectoryFilters } from "@/tenant/features/sessions/hooks/useSessionsDirectoryFilters";
import { useSessionsKeyboardShortcuts } from "@/tenant/features/sessions/hooks/useSessionsKeyboardShortcuts";
import { useSessionsDialogs } from "@/tenant/features/sessions/hooks/useSessionsDialogs";
import { useSessionConfig } from "@/hooks/useStandardModuleConfig";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { SESSIONS_MODULE_MANIFEST, type SessionsListPageResult } from "@mms/shared";
import { useSessionsPageCrudActions } from "@/tenant/features/sessions/hooks/useSessionsPageCrudActions";
import {
  defaultSessionsExportColumns,
  useSessionsExportActions,
} from "@/tenant/features/sessions/hooks/useSessionsExportActions";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { toggleFilterValue } from "@/tenant/features/sessions/hooks/sessionsPageControllerActions";

export function useSessionsPageController() {
  const {
    canWrite,
    canDelete,
    canExport,
    canReports: canViewReports,
    canViewSetup,
  } = useModulePermissions(SESSIONS_MODULE_MANIFEST);
  const PAGE_TABS = useFilteredModuleTierTabs({
    canViewSetup,
    canViewReports,
    workLabelKey: "nav.sessions",
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
    logExportAudit,
  } = useSessionMutations();
  const { types } = useSessionConfig();
  const { statusOptions, typeOptions, statusLabels, typeLabels, statusConfig, typeConfig } =
    useSessionDisplayConfig({ types, t });

  const columnLayout = useSessionColumnLayout();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const directory = useSessionsDirectoryFilters();
  const dialogs = useSessionsDialogs((id, reason) => crudActions.handleDelete(id, reason));
  const [activeTab, setActiveTab] = usePersistedTabState<string>("sessions_active_tab", "work");

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
    logExportAudit,
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
    setSelectedValues: React.Dispatch<React.SetStateAction<T[]>>,
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
