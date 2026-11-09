import { useState } from "react";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { useTranslation } from "@/hooks/useTranslation";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { todayISO, ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { useAttendanceRoster } from "@/tenant/features/attendance/hooks/useAttendance";
import { useAttendancePageActions } from "@/tenant/features/attendance/hooks/useAttendancePageActions";
import { useAttendanceColumnLayout } from "@/tenant/features/attendance/hooks/useAttendanceColumnLayout";
import { useAttendancePageTabs } from "@/tenant/features/attendance/hooks/useAttendancePageTabs";
import { ATTENDANCE_WORK_SEARCH_INPUT_ID } from "@/tenant/features/attendance/components/AttendanceListFilters";
import { useViewerRole } from "@/tenant/hooks/useViewerRole";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useWorkDrillDownListener } from "@/lib/query/useWorkDrillDownListener";
import {
  ATTENDANCE_WORK_DRILLDOWN_EVENT,
  consumeAttendanceWorkDrillDown,
  type AttendanceWorkDrillDown,
} from "@/tenant/features/attendance/hooks/attendanceWorkDrillDown";

const DEFAULT_FILTERS = {
  sessionId: "",
  classId: "",
  facultyId: "",
  date: todayISO(),
};

export function useAttendancePageController() {
  const { t } = useTranslation();
  const { canViewSetup } = useModulePermissions(ATTENDANCE_MODULE_MANIFEST);
  const { can } = usePermissions();
  const role = useViewerRole();
  const [activeTab, setActiveTab] = usePersistedTabState<string>("attendance_active_tab", "work");
  const [activeOpsTab, setActiveOpsTab] = useState("mark");
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState("charts");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [shownCount, setShownCount] = useState(0);
  useWorkDrillDownListener<AttendanceWorkDrillDown>(
    ATTENDANCE_WORK_DRILLDOWN_EVENT,
    consumeAttendanceWorkDrillDown,
    (drillDown) => {
      setActiveTab("work");
      setActiveOpsTab("records");
      setShowDeleted(false);
      if (drillDown.date) setFilters((prev) => ({ ...prev, date: drillDown.date ?? prev.date }));
    },
  );
  // Mark consumes the roster for the class/day in view (not a capped workspace-wide collection:
  // a truncated view would render unmarked defaults over recorded absences and save them back).
  const attendanceRosterQuery = useAttendanceRoster({
    classId: filters.classId,
    date: filters.date,
    sectionId: "sectionId" in filters ? String(filters.sectionId ?? "") : undefined,
  });
  const attendanceCollectionQuery = attendanceRosterQuery;
  const activeAttendanceRecords = attendanceRosterQuery.data;
  // Work records list is server-paged inside `AttendanceRecords` (filters colocated
  // with the toolbar). `shownCount` is reported back via `onTotalChange` for the
  // metrics strip; Mark consumes the roster while Reports use SQL aggregates.
  const columnLayout = useAttendanceColumnLayout();
  const {
    messagingTarget,
    closeComposer,
    handleMessageAttendance,
    persistRecords,
    handleUpdateRecord,
    handleDeleteRecord,
    handleRestoreRecord,
    handleBulkDeleteRecords,
    handleBulkRestoreRecords,
  } = useAttendancePageActions();

  const {
    canWriteAttendance,
    canDeleteAttendance,
    canAnalyticsView,
    visibleTopTabs,
    visibleOperationsTabs,
    visibleAnalyticsTabs,
    effectiveTab,
    effectiveOpsTab,
    effectiveAnalyticsTab,
  } = useAttendancePageTabs(activeTab, activeOpsTab, activeAnalyticsTab, canViewSetup);

  useModuleShortcuts({
    enabled: activeTab === "work",
    canWrite: canWriteAttendance,
    showDeleted,
    onCreate: () => {
      setActiveTab("work");
      setActiveOpsTab("mark");
    },
    searchInputId: ATTENDANCE_WORK_SEARCH_INPUT_ID,
    clearSelection: () => {
      closeComposer();
    },
  });

  return {
    t,
    can,
    role,
    filters,
    setFilters,
    showDeleted,
    setShowDeleted,
    activeTab,
    setActiveTab,
    activeOpsTab,
    setActiveOpsTab,
    activeAnalyticsTab,
    setActiveAnalyticsTab,
    attendanceCollectionQuery,
    activeAttendanceRecords,
    shownCount,
    setShownCount,
    columnLayout,
    messagingTarget,
    closeComposer,
    handleMessageAttendance,
    persistRecords,
    handleUpdateRecord,
    handleDeleteRecord,
    handleRestoreRecord,
    handleBulkDeleteRecords,
    handleBulkRestoreRecords,
    canWriteAttendance,
    canDeleteAttendance,
    canAnalyticsView,
    visibleTopTabs,
    visibleOperationsTabs,
    visibleAnalyticsTabs,
    effectiveTab,
    effectiveOpsTab,
    effectiveAnalyticsTab,
  };
}
