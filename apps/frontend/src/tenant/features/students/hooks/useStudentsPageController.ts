import { useEffect, useMemo } from "react";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useModuleTierPageNav } from "@/tenant/hooks/useModuleTierPageNav";
import { STUDENTS_MODULE_MANIFEST, resolveStudentStatuses } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useStudentsMetrics } from "@/tenant/features/students/hooks/useStudentsAnalyticsQueries";
import { useStudentMutations } from "@/tenant/features/students/hooks/useStudents";
import { useStudentColumnLayout } from "@/tenant/features/students/hooks/useStudentColumnLayout";
import { useStudentConfig } from "@/hooks/useStandardModuleConfig";
import { useGrMigration } from "@/tenant/features/students/hooks/useGrMigration";
import { useStudentsDirectoryFilters } from "@/tenant/features/students/hooks/useStudentsDirectoryFilters";
import { useStudentsKeyboardShortcuts } from "@/tenant/features/students/hooks/useStudentsKeyboardShortcuts";
import { useStudentsPageDirectoryProps } from "@/tenant/features/students/hooks/useStudentsPageDirectoryProps";
import { useStudentsPageFormState } from "@/tenant/features/students/hooks/useStudentsPageFormState";
import { useStudentsPageTabPanelProps } from "@/tenant/features/students/hooks/useStudentsPageTabPanelProps";
import { buildStudentsWorkSource } from "@/tenant/features/students/hooks/useStudentsWorkTierSource";
import { useStudentsPageWorkQuery } from "@/tenant/features/students/hooks/useStudentsPageWorkQuery";
import { useStudentsSelectionTargets } from "@/tenant/features/students/hooks/useStudentsSelectionTargets";
import { useStudentsCrudActions } from "@/tenant/features/students/hooks/useStudentsCrudActions";
import { useStudentsPageOverlayState } from "@/tenant/features/students/hooks/useStudentsPageOverlayState";
import { useStudentsPageOverlayProps } from "@/tenant/features/students/hooks/useStudentsPageOverlayProps";
import {
  defaultStudentsExportColumns,
  useStudentsExportActions,
} from "@/tenant/features/students/hooks/useStudentsExportActions";

export function useStudentsPageController() {
  const { t } = useTranslation();
  const {
    canWrite,
    canDelete,
    canExport,
    canEditSetup,
    visibleTabs,
    setActiveTab,
    effectiveTab,
  } = useModuleTierPageNav({
    manifest: STUDENTS_MODULE_MANIFEST,
    workLabelKey: "nav.students",
    storageKey: "students_active_tab",
  });

  const { data: metrics } = useStudentsMetrics();
  const mutations = useStudentMutations();
  const {
    settings,
    statuses: configuredStatuses,
    genderFilters,
    isFieldEnabled,
  } = useStudentConfig();
  const studentStatusOptions = resolveStudentStatuses(configuredStatuses);
  const formState = useStudentsPageFormState();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();

  useGrMigration(effectiveTab, canEditSetup);

  const columnLayout = useStudentColumnLayout(settings);
  const directory = useStudentsDirectoryFilters({ setActiveTab });
  const { setListPage } = directory;

  useEffect(() => {
    setListPage(1);
  }, [viewMode, setListPage]);

  useStudentsKeyboardShortcuts({
    selectedCount: directory.selectedIds.length,
    hasActiveFilters: directory.hasActiveFilters,
    clearFilters: directory.clearFilters,
    clearSelection: directory.clearSelection,
    canWrite,
    showDeleted: directory.viewingDeleted,
    onCreate: formState.openCreateForm,
  });

  const useServerWork = effectiveTab === "work";
  const { workPageQuery, workStudents, shownCount } = useStudentsPageWorkQuery({
    enabled: useServerWork,
    listPage: directory.listPage,
    debouncedSearch: directory.debouncedSearch,
    studentFilterStatus: directory.studentFilterStatus,
    studentFilterGender: directory.studentFilterGender,
    quickFilter: directory.quickFilter,
    sortField: directory.sortField,
    sortDir: directory.sortDir,
    viewingDeleted: directory.viewingDeleted,
  });

  const { allSelected, someSelected } = useStudentsPageDirectoryProps({
    workStudents,
    selectedIds: directory.selectedIds,
  });

  const selectedTargets = useStudentsSelectionTargets({
    selectedIds: directory.selectedIds,
    workStudents,
  });

  const workActions = useStudentsCrudActions({
    editStudent: formState.editStudent,
    mutations,
  });

  const overlays = useStudentsPageOverlayState();

  const exportColumns = useMemo(() => {
    const visible = columnLayout.columnRegistry.filter(
      (col) => columnLayout.isColumnVisible(col.key) && col.key !== "sessions",
    );
    if (visible.length === 0) return defaultStudentsExportColumns(t);
    return visible.map((col) => ({
      id: col.key,
      label: col.label || col.key,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the column-registry slices; depending on the whole `columnLayout` object (new each render) would rebuild the export columns on every render.
  }, [columnLayout.columnRegistry, columnLayout.isColumnVisible, t]);

  const { handleExportCSV, handleBulkExport } = useStudentsExportActions({
    tableColumns: exportColumns,
    canExport,
    // Debounced: the export must cover exactly what the visible list was filtered by.
    search: directory.debouncedSearch,
    filterStatus: directory.studentFilterStatus,
    filterGender: directory.studentFilterGender,
    quickFilter: directory.quickFilter,
    sortField: directory.sortField,
    sortDir: directory.sortDir,
    viewingDeleted: directory.viewingDeleted,
    hasActiveFilters: directory.hasActiveFilters,
    selectedIds: directory.selectedIds,
    logExportAudit: mutations.logExportAudit,
  });

  const tabPanelProps = useStudentsPageTabPanelProps(
    effectiveTab,
    buildStudentsWorkSource({
      directory,
      formState,
      workActions,
      overlays,
      workStudents,
      workPageQuery,
      useServerWork,
      viewMode,
      setViewMode,
      columnLayout,
      studentStatusOptions,
      genderFilters,
      canWrite,
      canDelete,
      canExport,
      isFieldEnabled,
      selectedTargets,
      allSelected,
      someSelected,
      handleBulkExport,
      bulkStatusPending: mutations.bulkUpdateStudentStatus.isPending,
    }),
  );

  const pageOverlaysProps = useStudentsPageOverlayProps({
    canWrite,
    canDelete,
    formState,
    overlays,
    workActions,
    selectedIds: directory.selectedIds,
    clearSelection: directory.clearSelection,
  });

  return {
    canWrite,
    canExport,
    visibleTabs,
    metricsTotal: metrics?.total,
    metricsSnapshot: metrics ?? null,
    activeTab: effectiveTab,
    setActiveTab,
    viewingDeleted: directory.viewingDeleted,
    shownCount,
    openCreateForm: formState.openCreateForm,
    handleExportCSV,
    tabPanelProps,
    pageOverlaysProps,
  };
}
