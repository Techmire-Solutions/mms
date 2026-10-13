import { useState, useEffect, useDeferredValue } from "react";
import { type AttendanceRecord } from "@/lib/data/attendanceData";
import { useAttendanceConfig } from "@/hooks/useStandardModuleConfig";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { ATTENDANCE_MODULE_MANIFEST, type AppTranslationKey } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useDebounce } from "@/hooks/useDebounce";
import { notify } from "@/lib/notify";
import { useAttendanceSelection } from "@/tenant/features/attendance/hooks/useAttendanceSelection";
import { useAttendancePaginated } from "@/tenant/features/attendance/hooks/useAttendance";
import {
  ALWAYS_COLUMN_VISIBLE,
  ATTENDANCE_COLUMN_KEYS,
  ATTENDANCE_SEARCH_DEBOUNCE_MS,
  type AttendanceRecordsProps,
} from "../lib/attendanceRecordsTypes";

export function useAttendanceRecordsState({
  filters,
  onUpdateRecord,
  onBulkDeleteRecords,
  onBulkRestoreRecords,
  showDeleted = false,
  isColumnVisible,
  onTotalChange,
}: AttendanceRecordsProps) {
  const { statuses } = useAttendanceConfig();
  const { t } = useTranslation();
  const { canWrite: canWriteAttendance, canDelete: canDeleteAttendance } = useModulePermissions(
    ATTENDANCE_MODULE_MANIFEST,
  );
  const sessions = useSessionsCollection();

  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [listPage, setListPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  const debouncedSearch = useDebounce(searchInput, ATTENDANCE_SEARCH_DEBOUNCE_MS);
  const deferredSearch = useDeferredValue(debouncedSearch);

  useEffect(() => {
    setListPage(1);
  }, [
    deferredSearch,
    statusFilter,
    dateFrom,
    dateTo,
    filters.sessionId,
    filters.classId,
    filters.facultyId,
    filters.date,
    showDeleted,
  ]);

  const attendancePageQuery = useAttendancePaginated({
    page: listPage,
    limit: ATTENDANCE_MODULE_MANIFEST.defaultPageSize,
    search: deferredSearch,
    sessionId: filters.sessionId,
    classId: filters.classId,
    facultyId: filters.facultyId,
    date: filters.date,
    status: statusFilter !== "all" ? statusFilter : undefined,
    dateFrom,
    dateTo,
    includeDeleted: showDeleted,
  });

  const pageRecords = attendancePageQuery.data?.records ?? [];
  const serverTotal = attendancePageQuery.data?.total ?? 0;
  const serverPage = attendancePageQuery.data?.page ?? listPage;
  const serverLimit = attendancePageQuery.data?.limit ?? ATTENDANCE_MODULE_MANIFEST.defaultPageSize;
  const serverHasMore = attendancePageQuery.data?.hasMore ?? false;

  useEffect(() => {
    onTotalChange?.(serverTotal);
  }, [onTotalChange, serverTotal]);

  const {
    selectedIds,
    setSelectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAll,
    toggleSelectedRecord,
    clearSelection,
  } = useAttendanceSelection(pageRecords);

  useEffect(() => {
    clearSelection();
  }, [
    showDeleted,
    listPage,
    debouncedSearch,
    statusFilter,
    dateFrom,
    dateTo,
    filters.sessionId,
    filters.classId,
    filters.facultyId,
    filters.date,
    clearSelection,
  ]);

  const statusMap = new Map<string, (typeof statuses)[number]>();
  for (const s of statuses) {
    if (s?.id != null) statusMap.set(s.id, s);
  }

  const statusLabel = (statusId: string) =>
    statusMap.get(statusId)?.label ?? t(`attendance.status.${statusId}` as AppTranslationKey);

  const columnVisible = isColumnVisible ?? ALWAYS_COLUMN_VISIBLE;
  const visibleColCount =
    ATTENDANCE_COLUMN_KEYS.filter(columnVisible).length + (canDeleteAttendance ? 1 : 0) + 1;

  const updateDraft = <K extends keyof AttendanceRecord>(key: K, value: AttendanceRecord[K]) => {
    setEditingRecord((current) => (current ? { ...current, [key]: value } : current));
  };

  const saveEditingRecord = async () => {
    if (!editingRecord || !canWriteAttendance) return;
    try {
      await onUpdateRecord(editingRecord);
      notify.success(t("attendance.toast.updated"));
      setEditingRecord(null);
    } catch (error) {
      notify.error(t("attendance.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const classMap = new Map<string, string>();
  for (const session of sessions) {
    for (const c of session.classes || []) {
      if (c?.id != null && c.name) classMap.set(c.id, c.name);
    }
  }

  const classLabel = (classId: string) => classMap.get(classId) || classId;

  const confirmBulkTrash = (): void => {
    if (showDeleted) void onBulkRestoreRecords(selectedIds);
    else void onBulkDeleteRecords(selectedIds);
    setSelectedIds([]);
    setConfirmBulkOpen(false);
  };

  return {
    t,
    statuses,
    canWriteAttendance,
    canDeleteAttendance,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    listPage,
    setListPage,
    editingRecord,
    setEditingRecord,
    pendingDeleteId,
    setPendingDeleteId,
    confirmBulkOpen,
    setConfirmBulkOpen,
    attendancePageQuery,
    pageRecords,
    serverTotal,
    serverPage,
    serverLimit,
    serverHasMore,
    selectedIds,
    setSelectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAll,
    toggleSelectedRecord,
    statusLabel,
    columnVisible,
    visibleColCount,
    updateDraft,
    saveEditingRecord,
    classLabel,
    confirmBulkTrash,
  };
}
