import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { type AttendanceRecord, type ClassStudent } from "@/lib/data/attendanceData";
import { useAttendanceConfig } from "@/hooks/useStandardModuleConfig";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useEnrollmentsCollection } from "@/tenant/hooks/collections/enrollments";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import {
  flushAuditQueue,
  queueAuditEntry,
} from "@/tenant/features/attendance/lib/markAttendanceQueue";
import {
  isEnrollmentInAttendanceRoster,
  existingRecordsForRoster,
  resolveSessionAndClassInfo,
} from "@/tenant/features/attendance/lib/markAttendanceRowUtils"; // roster + session helpers
import {
  loadQueue,
  useMarkAttendancePersistence,
} from "@/tenant/features/attendance/hooks/useMarkAttendancePersistence";
import { useAttendanceDaySubmission } from "@/tenant/features/attendance/hooks/useAttendanceDaySubmission";
import { useRosterDirtyTracking } from "@/tenant/features/attendance/hooks/useRosterDirtyTracking";
import type {
  AttendanceRow,
  GeoData,
  MarkAttendanceProps,
  OfflinePayload,
} from "@/tenant/features/attendance/lib/markAttendanceTypes";
import {
  applyPersistedRows,
  baselineOf,
  mergeServerRows,
  computeRosterStats,
  filterRowsByName,
  rowSignature,
  setRowStatus,
  resolveRosterStudents,
  seedRowsFor,
  type RowBaseline,
} from "@/tenant/features/attendance/lib/markAttendanceRowState";

export function useMarkAttendanceController({
  filters,
  role,
  records,
  persistBatch,
  onOverrideRequired,
  onDirtyChange,
  onSubmitDay,
  canReopenDay,
}: MarkAttendanceProps) {
  const { t } = useTranslation();
  const { statuses, customFields, orderedFields, isFieldEnabled } = useAttendanceConfig();
  const { canWrite: canWriteAttendance } = useModulePermissions(ATTENDANCE_MODULE_MANIFEST);
  const sessions = useSessionsCollection();
  const enrollments = useEnrollmentsCollection({
    enabled: Boolean(filters.classId),
    sessionId: filters.sessionId || undefined,
    classId: filters.classId || undefined,
  });
  const studentIds = (() => {
    if (!filters.classId) return [];
    return enrollments
      .filter((enrollment) =>
        isEnrollmentInAttendanceRoster(
          enrollment,
          filters.classId,
          filters.sectionId,
          filters.date,
        ),
      )
      .map((enrollment) => enrollment.studentId);
  })();

  const { data: enrolledStudents = [] } = useStudentsByIds(studentIds);

  const { classInfo, sessionInfo } = resolveSessionAndClassInfo(sessions, filters.classId);
  const students: ClassStudent[] = resolveRosterStudents({
    classId: filters.classId,
    sectionId: filters.sectionId,
    date: filters.date,
    enrollments,
    students: enrolledStudents,
    fallbackName: t("common.unnamedStudent"),
  });

  const baselineRef = useRef<Map<string, RowBaseline>>(new Map());
  const [conflictCount, setConflictCount] = useState(0);
  const [rowErrors, setRowErrors] = useState<Array<{ studentId?: string; message: string }>>([]);
  const daySubmission = useAttendanceDaySubmission(filters.classId, filters.date);
  const [rows, setRows] = useState<AttendanceRow[]>(() => {
    if (!filters.classId || !filters.date) return [];
    return seedRowsFor({ records, filters, students, customFields });
  });
  /** Seeds rows from a server snapshot and resets the dirty baseline. */
  const seedRows = (nextRows: AttendanceRow[]): void => {
    baselineRef.current = new Map(nextRows.map((row) => [row.studentId, baselineOf(row)]));
    setRows(nextRows);
    setConflictCount(0);
  };
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [geo, setGeo] = useState<GeoData | "loading" | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflinePayload[]>(loadQueue);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showFaceAI, setShowFaceAI] = useState(false);
  const [syncedMsg, setSyncedMsg] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => () => flushAuditQueue(), []); // never lose a buffered audit entry on unmount

  const studentRosterKey = students.map((student) => `${student.id}-${student.name}`).join("|");
  const stableKey = `${filters.classId}:${filters.sectionId ?? ""}:${filters.date}:${studentRosterKey}`;

  // Rebuild during render when class/date/roster changes, so the old roster is never editable under
  // the new filters (stableKey is the only input needed).
  const [prevStableKey, setPrevStableKey] = useState(stableKey);
  if (prevStableKey !== stableKey) {
    setPrevStableKey(stableKey);
    if (filters.classId && filters.date) {
      seedRows(seedRowsFor({ records, filters, students, customFields }));
      setSubmitted(false);
      setIsDraft(false);
      setGeo(null);
      setShowFaceAI(false);
    }
  }

  /**
   * Adopt server changes (refetch after save, stale-write recovery, another instructor's save)
   * **without** clobbering rows the user has edited: clean rows take the server value, dirty rows keep
   * their local value and drop the OCC token (the next save is then an explicit last-writer-wins).
   */
  const recordsSignature = useMemo(
    () =>
      existingRecordsForRoster(records, filters, students)
        .map((r) => rowSignature(r))
        .join("|"),
    // The signature (not the array identity) is what matters: parents recreate `records` freely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, filters.classId, filters.date, filters.sectionId, students.length],
  );

  useEffect(() => {
    if (!filters.classId || !filters.date || !recordsSignature) return;
    const serverRecords = existingRecordsForRoster(records, filters, students);
    setRows((currentRows) => {
      const result = mergeServerRows({
        currentRows,
        serverRecords,
        baseline: baselineRef.current,
      });
      setConflictCount((previous) =>
        result.conflicts > 0 && previous !== result.conflicts ? result.conflicts : previous,
      );
      return result.rows;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsSignature]);

  const isDirty = useRosterDirtyTracking({ rows, baseline: baselineRef, onDirtyChange });

  /** Applies the server's persisted rows after a save (ids + versions) and clears the baseline. */
  const applyPersisted = (persisted: AttendanceRecord[]): void => {
    if (persisted.length === 0) return;
    setRows((currentRows) =>
      applyPersistedRows({ currentRows, persisted, baseline: baselineRef.current }),
    );
    setConflictCount(0);
  };

  // Server truth plus local submit; derived so no effect has to setState.
  const submittedForUi = submitted || daySubmission.submission?.locked === true;

  const filteredRows = filterRowsByName(rows, search);
  const stats = computeRosterStats(rows);

  const setRow = useCallback(
    (studentId: string, key: string, value: unknown) => {
      const before = rows.find((row) => row.studentId === studentId);
      setRows((previousRows) =>
        previousRows.map((row) => (row.studentId === studentId ? { ...row, [key]: value } : row)),
      );
      if (filters.classId && filters.date && before) {
        queueAuditEntry(filters.classId, filters.date, {
          action: "edit",
          studentId,
          field: key,
          from: String(before[key] ?? ""),
          to: String(value),
          by: role,
        });
      }
    },
    [filters.classId, filters.date, role, rows],
  );

  const markAll = useCallback(
    (status: AttendanceRecord["status"]) => {
      setRows((previousRows) => previousRows.map((row) => ({ ...row, status })));
      queueAuditEntry(filters.classId, filters.date, {
        action: "bulk_mark",
        status,
        count: rows.length,
        by: role,
      });
    },
    [filters.classId, filters.date, role, rows.length],
  );

  const setStatus = useCallback(
    (studentId: string, status: AttendanceRecord["status"]) =>
      setRows((previousRows) => setRowStatus(previousRows, studentId, status)),
    [],
  );

  const requestGeo = () => {
    setGeo("loading");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setGeo(null),
      );
    } else {
      setGeo(null);
    }
  };

  const { handleSaveDraft, handleSubmit, handleSync } = useMarkAttendancePersistence({
    filters,
    role,
    rows,
    geo,
    isOffline,
    offlineQueue,
    setOfflineQueue,
    setIsDraft,
    setSubmitted,
    setSyncedMsg,
    customFields,
    persistBatch,
    onOverrideRequired,
    onPersisted: applyPersisted,
    onSubmitDay,
    onRowErrors: setRowErrors,
  });

  return {
    t,
    filters,
    statuses,
    orderedFields,
    isFieldEnabled,
    canWriteAttendance,
    classInfo,
    sessionInfo,
    rows,
    search,
    setSearch,
    submitted: submittedForUi,
    isDraft,
    geo,
    offlineQueue,
    isOffline,
    showFaceAI,
    setShowFaceAI,
    syncedMsg,
    filteredRows,
    stats,
    setRow,
    markAll,
    requestGeo,
    handleSaveDraft,
    handleSync,
    handleSubmit,
    isDirty,
    conflictCount,
    dismissConflicts: () => setConflictCount(0),
    resetToServer: () => seedRows(seedRowsFor({ records, filters, students, customFields })),
    canReopenDay: canReopenDay === true,
    daySubmission,
    setStatus,
    rowErrors,
    dismissRowErrors: () => setRowErrors([]),
  };
}
