import { useState } from "react";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { useTranslation } from "@/hooks/useTranslation";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { todayISOInTimeZone, ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { useAttendanceRoster } from "@/tenant/features/attendance/hooks/useAttendance";
import { useAttendancePageActions } from "@/tenant/features/attendance/hooks/useAttendancePageActions";
import { useAttendanceColumnLayout } from "@/tenant/features/attendance/hooks/useAttendanceColumnLayout";
import { useAttendancePageTabs } from "@/tenant/features/attendance/hooks/useAttendancePageTabs";
import { ATTENDANCE_WORK_SEARCH_INPUT_ID } from "@/tenant/features/attendance/components/AttendanceListFilters";
import { useViewerRole } from "@/tenant/hooks/useViewerRole";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useWorkDrillDownListener } from "@/lib/query/useWorkDrillDownListener";
import {
  ATTENDANCE_WORK_DRILLDOWN_EVENT,
  consumeAttendanceWorkDrillDown,
  type AttendanceWorkDrillDown,
} from "@/tenant/features/attendance/hooks/attendanceWorkDrillDown";

interface AttendancePageFilters {
  sessionId: string;
  classId: string;
  facultyId: string;
  date: string;
}

/**
 * Fresh filter defaults. The marking day comes from the *workspace* timezone because the server
 * evaluates the cut-off, the day lock and "past day" rules there: a device clock in another zone
 * (`todayISO()`) names yesterday for a UTC device in a UTC+05:00 workspace after 19:00Z, and the
 * bulk save comes back 422 `attendance_override_reason_required`.
 */
function createDefaultFilters(timeZone: string | null | undefined): AttendancePageFilters {
  return {
    sessionId: "",
    classId: "",
    facultyId: "",
    date: todayISOInTimeZone(timeZone),
  };
}

export function useAttendancePageController() {
  const { t } = useTranslation();
  const { timezone } = useGlobalSettings();
  const { canViewSetup } = useModulePermissions(ATTENDANCE_MODULE_MANIFEST);
  const { can } = usePermissions();
  const role = useViewerRole();
  const [activeTab, setActiveTab] = usePersistedTabState<string>("attendance_active_tab", "work");
  const [activeOpsTab, setActiveOpsTab] = useState("mark");
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState("charts");
  const [filters, setFilters] = useState<AttendancePageFilters>(() =>
    createDefaultFilters(timezone),
  );
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [shownCount, setShownCount] = useState(0);
  /** Set by the marking grid: unsaved roster edits block class/date/tier switches. */
  const [rosterDirty, setRosterDirty] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<AttendancePageFilters | null>(null);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
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
  /**
   * Filter changes that would discard unsaved marks are routed through a confirmation instead of
   * being applied immediately. Class/date/section are the roster-defining fields; a faculty-only
   * change does not lose edits.
   */
  const requestFiltersChange = (next: AttendancePageFilters): void => {
    const current = filters as AttendancePageFilters & { sectionId?: string };
    const target = next as AttendancePageFilters & { sectionId?: string };
    const losesRoster =
      target.classId !== current.classId ||
      target.date !== current.date ||
      (target.sectionId ?? "") !== (current.sectionId ?? "");
    if (rosterDirty && losesRoster) {
      setPendingFilters(next);
      return;
    }
    setFilters(next);
  };

  const requestOpsTabChange = (next: string): void => {
    if (rosterDirty && next !== "mark") {
      setPendingTab(next);
      return;
    }
    setActiveOpsTab(next);
  };

  const confirmDiscardRoster = (): void => {
    if (pendingFilters) setFilters(pendingFilters);
    if (pendingTab) setActiveOpsTab(pendingTab);
    setPendingFilters(null);
    setPendingTab(null);
    setRosterDirty(false);
  };

  const cancelDiscardRoster = (): void => {
    setPendingFilters(null);
    setPendingTab(null);
  };

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
    submitRosterDay,
    reopenRosterDay,
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
    submitRosterDay,
    reopenRosterDay,
    canWriteAttendance,
    canDeleteAttendance,
    /** Reopen a submitted day (delete-level). */
    canReopenAttendance: canDeleteAttendance,
    rosterDirty,
    setRosterDirty,
    pendingRosterDiscard: pendingFilters !== null || pendingTab !== null,
    requestFiltersChange,
    requestOpsTabChange,
    confirmDiscardRoster,
    cancelDiscardRoster,
    canAnalyticsView,
    visibleTopTabs,
    visibleOperationsTabs,
    visibleAnalyticsTabs,
    effectiveTab,
    effectiveOpsTab,
    effectiveAnalyticsTab,
  };
}
