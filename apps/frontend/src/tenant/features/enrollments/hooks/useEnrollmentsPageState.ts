import { useState, useEffect } from "react";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { useTranslation } from "@/hooks/useTranslation";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { ClipboardList, UserCheck, Inbox } from "lucide-react";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { type Enrollment } from "@/lib/data/enrollmentData";
import {
  useEnrollmentMutations,
  useEnrollmentsPaginated,
} from "@/tenant/features/enrollments/hooks/useEnrollmentsApi";
import { useEnrollmentsDirectoryFilters } from "@/tenant/features/enrollments/hooks/useEnrollmentsDirectoryFilters";
import { ENROLLMENTS_MODULE_MANIFEST } from "@mms/shared";
import { useEnrollmentsPageActions } from "@/tenant/features/enrollments/hooks/useEnrollmentsPageActions";
import {
  defaultEnrollmentsExportColumns,
  useEnrollmentsExportActions,
} from "@/tenant/features/enrollments/hooks/useEnrollmentsExportActions";
import { useEnrollmentColumnLayout } from "@/tenant/features/enrollments/hooks/useEnrollmentColumnLayout";
import { useEnrollmentsSelection } from "@/tenant/features/enrollments/hooks/useEnrollmentsSelection";

export function useEnrollmentsPageState() {
  const { t } = useTranslation();
  const SUB_TABS = (() => [
      { id: "directory", label: t("enrollments.list"), icon: ClipboardList },
      { id: "eligibility", label: t("enrollments.eligibility"), icon: UserCheck },
      { id: "admissions", label: t("enrollments.admissions.title"), icon: Inbox },
    ])();
  const permissions = useModulePermissions(ENROLLMENTS_MODULE_MANIFEST);
  const {
    canWrite: canWriteEnrollments,
    canDelete,
    canExport,
    canReports: canViewReports,
    canViewSetup,
  } = permissions;

  const TABS = useFilteredModuleTierTabs({
    canViewSetup,
    canViewReports,
    workLabelKey: "nav.enrollments",
  });
  const [tab, setTab] = usePersistedTabState<string>("enrollments_active_tab", "work");
  const [activeSubTab, setActiveSubTab] = useState("directory");
  const directoryFilters = useEnrollmentsDirectoryFilters();
  const {
    listPage,
    setListPage,
    showDeleted,
    setShowDeleted,
    search,
    setSearch,
    debouncedSearch,
    statusFilter,
    setStatusFilter,
    sessionFilter,
    setSessionFilter,
  } = directoryFilters;

  const useServerWork = tab === "work" && activeSubTab === "directory";
  /** Drives the export audit scope and the shortcuts gate (same definition, one place). */
  const hasActiveFilters =
    statusFilter !== "all" || sessionFilter !== "all" || Boolean(debouncedSearch.trim());
  const {
    data: workPageData,
    isError: isWorkPageError,
    refetch: refetchWorkPage,
  } = useEnrollmentsPaginated({
    page: listPage,
    limit: ENROLLMENTS_MODULE_MANIFEST.defaultPageSize,
    search: debouncedSearch,
    status: statusFilter !== "all" ? statusFilter : undefined,
    sessionId: sessionFilter !== "all" ? sessionFilter : undefined,
    includeDeleted: showDeleted,
    enabled: useServerWork,
  });

  const pageData = (workPageData?.body ?? workPageData) as { enrollments?: Enrollment[]; total?: number } | undefined;

  const enrollments = (() => (pageData?.enrollments ?? []) as Enrollment[])();
  const filteredCount = pageData?.total ?? enrollments.length;

  const [viewing, setViewing] = useState<Enrollment | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [confirmBulkRestoreOpen, setConfirmBulkRestoreOpen] = useState(false);
  const columnLayout = useEnrollmentColumnLayout();
  const selection = useEnrollmentsSelection(enrollments);

  useEffect(() => {
    selection.setSelectedIds([]);
  }, [debouncedSearch, statusFilter, sessionFilter, showDeleted, selection.setSelectedIds]);

  const { logExportAudit } = useEnrollmentMutations();
  const exportColumns = (() => defaultEnrollmentsExportColumns(t))();
  const exportActions = useEnrollmentsExportActions({
    tableColumns: exportColumns,
    canExport,
    // Debounced: the export must cover exactly what the visible list was filtered by.
    search: debouncedSearch,
    statusFilter,
    sessionFilter,
    viewingDeleted: showDeleted,
    hasActiveFilters,
    selectedIds: selection.selectedIds,
    logExportAudit,
  });

  useEffect(() => {
    if (!canWriteEnrollments && activeSubTab === "eligibility") {
      setActiveSubTab("directory");
    }
  }, [canWriteEnrollments, activeSubTab]);

  useModuleShortcuts({
    searchInputId: "enrollments-search-input",
    selectedCount: selection.selectedIds.length,
    hasActiveFilters,
    clearFilters: () => {
      setStatusFilter("all");
      setSessionFilter("all");
      setSearch("");
    },
    clearSelection: selection.clearSelection,
    canWrite: canWriteEnrollments,
    showDeleted,
    onCreate: () => {
      setTab("work");
      setShowWizard(true);
    },
    enabled: tab === "work",
  });

  const pageActions = useEnrollmentsPageActions({
    enrollments,
    viewing,
    onViewingChange: setViewing,
    onActiveSubTabChange: setActiveSubTab,
  });

  const canSelectEnrollments = canWriteEnrollments || canDelete;

  return {
    t,
    SUB_TABS,
    TABS,
    tab,
    setTab,
    activeSubTab,
    setActiveSubTab,
    canWriteEnrollments,
    canDelete,
    canExport,
    canSelectEnrollments,
    directoryFilters,
    enrollments,
    filteredCount,
    isWorkPageError,
    refetchWorkPage,
    viewing,
    setViewing,
    showWizard,
    setShowWizard,
    pendingDeleteId,
    setPendingDeleteId,
    confirmBulkDeleteOpen,
    setConfirmBulkDeleteOpen,
    confirmBulkRestoreOpen,
    setConfirmBulkRestoreOpen,
    columnLayout,
    selection,
    exportActions,
    pageActions,
  };
}
