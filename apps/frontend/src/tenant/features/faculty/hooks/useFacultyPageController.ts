import { useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { FACULTY_MODULE_MANIFEST } from "@mms/shared";
import { useFacultyMutations, useFacultyMetrics } from "@/tenant/features/faculty/hooks/useFaculty";
import { useFacultyDirectoryFilters } from "@/tenant/features/faculty/hooks/useFacultyDirectoryFilters";
import { useEmployeeIdMigration } from "@/tenant/features/faculty/hooks/useEmployeeIdMigration";
import { useFacultyKeyboardShortcuts } from "@/tenant/features/faculty/hooks/useFacultyKeyboardShortcuts";
import { useFacultyPageActions } from "@/tenant/features/faculty/hooks/useFacultyPageActions";
import { useFacultyPageFormState } from "@/tenant/features/faculty/hooks/useFacultyPageFormState";
import { useFacultyPageOverlayState } from "@/tenant/features/faculty/hooks/useFacultyPageOverlayState";
import { useFacultyPageOverlayProps } from "@/tenant/features/faculty/hooks/useFacultyPageOverlayProps";
import { useFacultyColumnLayout } from "@/tenant/features/faculty/hooks/useFacultyColumnLayout";
import { useFacultyLookupOptions } from "@/tenant/features/faculty/hooks/useFacultyStatusConfig";
import { useFacultyConfig } from "@/hooks/useStandardModuleConfig";
import { useFacultyWorkTierState } from "@/tenant/features/faculty/hooks/useFacultyWorkTierState";
import { useFacultyWorkPanelProps } from "@/tenant/features/faculty/hooks/useFacultyWorkPanelProps";
import {
  FACULTY_PAGE_TAB_DEFAULT,
  FACULTY_PAGE_TAB_HINT_KEYS,
  FACULTY_PAGE_TAB_ICONS,
  FACULTY_PAGE_TAB_IDS,
  FACULTY_PAGE_TAB_KEYS,
  migrateFacultyPageTab,
  resolveFacultyPageTab,
} from "@/tenant/features/faculty/facultyPageWorkSubTabs";
import { useFacultyIoActions } from "@/tenant/features/faculty/hooks/useFacultyIoActions";
import { useFacultyDirectoryFilterCatalog } from "@/tenant/features/faculty/hooks/useFacultyDirectoryFilterCatalog";

export function useFacultyPageController() {
  const { t } = useTranslation();
  const {
    canWrite,
    canDelete,
    canExport,
    canReports: canViewReports,
    canViewSetup,
    canEditSetup,
  } = useModulePermissions(FACULTY_MODULE_MANIFEST);

  const visibleTabs = FACULTY_PAGE_TAB_IDS.filter((id) => {
    if (id === "reports") return canViewReports;
    if (id === "setup") return canViewSetup;
    return true;
  }).map((id) => ({
    id,
    label: t(FACULTY_PAGE_TAB_KEYS[id]),
    description: t(FACULTY_PAGE_TAB_HINT_KEYS[id]),
    icon: FACULTY_PAGE_TAB_ICONS[id],
  }));

  const { data: metrics } = useFacultyMetrics();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const config = useFacultyConfig();
  const lookups = useFacultyLookupOptions();
  const columnLayout = useFacultyColumnLayout(config.settings);

  const [rawActiveTab, setActiveTab] = usePersistedTabState<string>(
    "faculty_active_tab",
    FACULTY_PAGE_TAB_DEFAULT,
  );
  const [legacyWorkSubTab] = usePersistedTabState<string>(
    "faculty_work_subtab",
    FACULTY_PAGE_TAB_DEFAULT,
  );

  useEffect(() => {
    if (
      rawActiveTab === "work" ||
      rawActiveTab === "operations" ||
      rawActiveTab === "departments"
    ) {
      setActiveTab(migrateFacultyPageTab(rawActiveTab, legacyWorkSubTab));
    }
  }, [rawActiveTab, legacyWorkSubTab, setActiveTab]);

  const effectiveTab = resolveFacultyPageTab(
    rawActiveTab,
    visibleTabs.map((tab) => tab.id),
    legacyWorkSubTab,
  );
  const showDirectoryActions = effectiveTab === "faculties";

  useEmployeeIdMigration(effectiveTab, canEditSetup);

  const filters = useFacultyDirectoryFilters({ setActiveTab });
  const filterCatalog = useFacultyDirectoryFilterCatalog(effectiveTab === "faculties");

  useEffect(() => {
    filters.setListPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filters.setListPage is a stable setter; depending on the whole `filters` object would run this page reset on every render.
  }, [viewMode, filters.setListPage]);

  const formState = useFacultyPageFormState();
  const overlays = useFacultyPageOverlayState();

  useFacultyKeyboardShortcuts({
    selectedCount: filters.selectedIds.length,
    hasActiveFilters: filters.hasActiveFilters,
    clearFilters: filters.clearFilters,
    clearSelection: filters.clearSelection,
    canWrite: canWrite && showDirectoryActions,
    showDeleted: filters.showDeleted,
    onCreate: formState.openCreate,
  });

  const mutations = useFacultyMutations();
  const pageActions = useFacultyPageActions({ editFaculty: formState.editFaculty });

  const workTierState = useFacultyWorkTierState({
    effectiveTab,
    listPage: filters.listPage,
    debouncedSearch: filters.debouncedSearch,
    filterStatus: filters.filterStatus,
    filterSpecialization: filters.filterSpecialization,
    filterGender: filters.filterGender,
    filterDepartment: filters.filterDepartment,
    filterDesignation: filters.filterDesignation,
    filterReportingFacultyId: filters.filterReportingFacultyId,
    quickFilter: filters.quickFilter,
    sortField: filters.sortField,
    sortDir: filters.sortDir,
    showDeleted: filters.showDeleted,
    columnLayout,
    canExport,
    hasActiveFilters: filters.hasActiveFilters,
    selectedIds: filters.selectedIds,
    logExportAudit: mutations.logExportAudit,
    t,
  });

  const tabPanelProps = useFacultyWorkPanelProps({
    effectiveTab,
    filters,
    filterCatalog,
    config,
    lookups,
    columnLayout,
    workTierState,
    mutations,
    pageActions,
    formState,
    overlays,
    viewMode,
    setViewMode,
    canWrite,
    canDelete,
    canExport,
  });

  const pageOverlaysProps = useFacultyPageOverlayProps({
    canWrite,
    canDelete,
    formState,
    overlays,
    workActions: {
      handleSaveFaculty: pageActions.handleSaveFaculty,
      handleRestore: pageActions.handleRestore,
      handleDelete: pageActions.handleDelete,
      handleBulkDelete: pageActions.handleBulkDelete,
      handleBulkRestore: pageActions.handleBulkRestore,
    },
    selectedIds: filters.selectedIds,
    clearSelection: filters.clearSelection,
  });

  const { onExportEntity, onImportEntity } = useFacultyIoActions({
    canExport,
    handleFacultyExport: workTierState.handleExportCSV,
    setImportEntity: overlays.setImportEntity,
  });

  return {
    canWrite,
    canExport,
    visibleTabs,
    showDirectoryActions,
    metricsTotal: metrics?.total,
    activeTab: effectiveTab,
    setActiveTab,
    viewingDeleted: filters.showDeleted,
    shownCount: workTierState.shownCount,
    openCreateForm: formState.openCreate,
    openCreateDepartment: () => overlays.setCreateDepartmentOpen(true),
    openCreateDesignation: () => overlays.setCreateDesignationOpen(true),
    onExportEntity,
    onImportEntity,
    tabPanelProps,
    pageOverlaysProps,
  };
}
