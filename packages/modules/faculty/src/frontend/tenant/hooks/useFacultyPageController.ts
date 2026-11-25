import { useEffect } from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { usePersistedTabState } from "@mms/fe-core/lib/usePersistedTabState";
import { useWorkDirectoryViewMode } from "@mms/fe-core/tenant";
import { useModulePermissions } from "./usePermissions";
import { FACULTY_MODULE_MANIFEST } from "@mms/contracts";
import { useFacultyMutations, useFacultyMetrics } from "./useFaculty";
import { useFacultyDirectoryFilters } from "./useFacultyDirectoryFilters";
import { useEmployeeIdMigration } from "./useEmployeeIdMigration";
import { useFacultyKeyboardShortcuts } from "./useFacultyKeyboardShortcuts";
import { useFacultyPageActions } from "./useFacultyPageActions";
import { useFacultyPageFormState } from "./useFacultyPageFormState";
import { useFacultyPageOverlayState } from "./useFacultyPageOverlayState";
import { useFacultyPageOverlayProps } from "./useFacultyPageOverlayProps";
import { useFacultyColumnLayout } from "./useFacultyColumnLayout";
import { useFacultyLookupOptions } from "./useFacultyStatusConfig";
import { useFacultyConfig } from "./useFacultyConfig";
import { useFacultyWorkTierState } from "./useFacultyWorkTierState";
import { useFacultyWorkPanelProps } from "./useFacultyWorkPanelProps";
import {
  FACULTY_PAGE_TAB_DEFAULT,
  FACULTY_PAGE_TAB_HINT_KEYS,
  FACULTY_PAGE_TAB_ICONS,
  FACULTY_PAGE_TAB_IDS,
  FACULTY_PAGE_TAB_KEYS,
  migrateFacultyPageTab,
  resolveFacultyPageTab,
} from "../facultyPageWorkSubTabs";
import { useFacultyIoActions } from "./useFacultyIoActions";
import { useFacultyDirectoryFilterCatalog } from "./useFacultyDirectoryFilterCatalog";

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
    if (rawActiveTab === "work" || rawActiveTab === "operations") {
      setActiveTab(migrateFacultyPageTab(rawActiveTab, legacyWorkSubTab));
    }
  }, [rawActiveTab, legacyWorkSubTab, setActiveTab]);

  const effectiveTab = resolveFacultyPageTab(
    rawActiveTab,
    visibleTabs.map((tab) => tab.id),
    legacyWorkSubTab,
  );
  // Repair the persisted tier so a no-longer-visible value cannot resurface.
  useEffect(() => {
    if (effectiveTab && effectiveTab !== rawActiveTab) setActiveTab(effectiveTab);
  }, [effectiveTab, rawActiveTab, setActiveTab]);

  const showDirectoryActions = effectiveTab === "faculties";

  useEmployeeIdMigration(effectiveTab, canEditSetup);

  const filters = useFacultyDirectoryFilters({ setActiveTab });
  const filterCatalog = useFacultyDirectoryFilterCatalog(effectiveTab === "faculties");

  const { setListPage } = filters;
  useEffect(() => {
    setListPage(1);
  }, [viewMode, setListPage]);

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
      onReportingFacultyChange: filters.setFilterReportingFacultyId,
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
