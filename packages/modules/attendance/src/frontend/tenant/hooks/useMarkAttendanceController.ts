import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { type AttendanceRecord, type ClassStudent } from "../lib/attendanceData";
import { useAttendanceConfig } from "../host/useAttendanceConfig";
import { useSessionsCollection } from "../host/sessionsCollection";
import { useEnrollmentsCollection } from "../host/enrollmentsCollection";
import { useStudentsByIds } from "../host/studentsCollection";
import { useModulePermissions } from "../host/usePermissions";
import { ATTENDANCE_MODULE_MANIFEST } from "@mms/contracts";
import { flushAuditQueue, queueAuditEntry } from "../lib/markAttendanceQueue";
import {
  isEnrollmentInAttendanceRoster,
  resolveSessionAndClassInfo,
} from "../lib/markAttendanceRowUtils";
import { loadQueue, useMarkAttendancePersistence } from "./useMarkAttendancePersistence";
import { useAttendanceDaySubmission } from "./useAttendanceDaySubmission";
import { useRosterDirtyTracking } from "./useRosterDirtyTracking";
import { useRosterGridState } from "./useRosterGridState";
import type { GeoData, MarkAttendanceProps, OfflinePayload } from "../lib/markAttendanceTypes";
import {
  computeRosterStats,
  filterRowsByName,
  setRowStatus,
  resolveRosterStudents,
  seedRowsFor,
} from "../lib/markAttendanceRowState";

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
  const studentIds = useMemo(() => {
    if (!filters.classId) return [];
    return enrollments
      .filter((enrollment: any) =>
        isEnrollmentInAttendanceRoster(
          enrollment,
          filters.classId,
          filters.sectionId,
          filters.date,
        ),
      )
      .map((enrollment: any) => enrollment.studentId);
  }, [enrollments, filters.classId, filters.sectionId, filters.date]);

  const { data: enrolledStudents = [] } = useStudentsByIds(studentIds);

  const { classInfo, sessionInfo } = useMemo(
    () => resolveSessionAndClassInfo(sessions, filters.classId),
    [sessions, filters.classId],
  );
  const students: ClassStudent[] = useMemo(
    () =>
      resolveRosterStudents({
        classId: filters.classId,
        sectionId: filters.sectionId,
        date: filters.date,
        enrollments,
        students: enrolledStudents,
        fallbackName: t("common.unnamedStudent"),
      }),
    [filters.classId, filters.sectionId, filters.date, enrollments, enrolledStudents, t],
  );

  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [rowErrors, setRowErrors] = useState<Array<{ studentId?: string; message: string }>>([]);
  const [geo, setGeo] = useState<GeoData | "loading" | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflinePayload[]>(loadQueue);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showFaceAI, setShowFaceAI] = useState(false);
  const [syncedMsg, setSyncedMsg] = useState(false);
  const daySubmission = useAttendanceDaySubmission(filters.classId, filters.date);

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
  const { grid, setGrid, rows, seedRows, applyPersisted, reseeded } = useRosterGridState({
    filters,
    records,
    students,
    customFields,
    rosterKey: stableKey,
  });
  // A roster reseed starts the day over: no submission state, no draft badge, no geo, no face AI.
  if (reseeded) {
    setSubmitted(false);
    setIsDraft(false);
    setGeo(null);
    setShowFaceAI(false);
  }

  const isDirty = useRosterDirtyTracking({ rows, baseline: grid.baseline, onDirtyChange });

  // Server truth plus local submit; derived so no effect has to setState.
  const submittedForUi = submitted || daySubmission.submission?.locked === true;

  const filteredRows = filterRowsByName(rows, search);
  const stats = computeRosterStats(rows);

  const setRow = useCallback(
    (studentId: string, key: string, value: unknown) => {
      const before = rows.find((row) => row.studentId === studentId);
      setGrid((current) => ({
        ...current,
        rows: current.rows.map((row) =>
          row.studentId === studentId ? { ...row, [key]: value } : row,
        ),
      }));
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
    [setGrid, filters.classId, filters.date, role, rows],
  );

  const markAll = useCallback(
    (status: AttendanceRecord["status"]) => {
      setGrid((current) => ({
        ...current,
        rows: current.rows.map((row) => ({ ...row, status })),
      }));
      queueAuditEntry(filters.classId, filters.date, {
        action: "bulk_mark",
        status,
        count: rows.length,
        by: role,
      });
    },
    [setGrid, filters.classId, filters.date, role, rows.length],
  );

  const setStatus = useCallback(
    (studentId: string, status: AttendanceRecord["status"]) =>
      setGrid((current) => ({
        ...current,
        rows: setRowStatus(current.rows, studentId, status),
      })),
    [setGrid],
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

  const { saving, handleSaveDraft, handleSubmit, handleSync } = useMarkAttendancePersistence({
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
    saving,
    handleSaveDraft,
    handleSync,
    handleSubmit,
    isDirty,
    conflictCount: grid.conflicts,
    dismissConflicts: () =>
      setGrid((current) => (current.conflicts === 0 ? current : { ...current, conflicts: 0 })),
    resetToServer: () => seedRows(seedRowsFor({ records, filters, students, customFields })),
    canReopenDay: canReopenDay === true,
    daySubmission,
    setStatus,
    rowErrors,
    dismissRowErrors: () => setRowErrors([]),
  };
}
