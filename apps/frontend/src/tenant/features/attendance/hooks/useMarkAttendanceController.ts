import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { type AttendanceRecord, type ClassStudent } from "@/lib/data/attendanceData";
import { useAttendanceConfig } from "@/hooks/useStandardModuleConfig";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useEnrollmentsCollection } from "@/tenant/hooks/collections/enrollments";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { addAuditEntry } from "@/tenant/features/attendance/lib/markAttendanceQueue";
import {
  attendanceRowsFromRecords,
  buildDefaultRows,
  enrolledStudentsForClass,
  isEnrollmentInAttendanceRoster,
  existingRecordsForRoster,
  resolveSessionAndClassInfo,
} from "@/tenant/features/attendance/lib/markAttendanceRowUtils";
import {
  loadQueue,
  useMarkAttendancePersistence,
} from "@/tenant/features/attendance/hooks/useMarkAttendancePersistence";
import type {
  AttendanceRow,
  GeoData,
  MarkAttendanceProps,
  OfflinePayload,
} from "@/tenant/features/attendance/lib/markAttendanceTypes";

export function useMarkAttendanceController({
  filters,
  role,
  records,
  persistBatch,
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
  const students: ClassStudent[] = (() => {
    if (!filters.classId) return [];
    return enrolledStudentsForClass(
      filters.classId,
      enrollments,
      enrolledStudents,
      t("common.unnamedStudent"),
      filters.sectionId,
      filters.date,
    );
  })();

  const [rows, setRows] = useState<AttendanceRow[]>(() => {
    if (!filters.classId || !filters.date) return [];
    const existing = existingRecordsForRoster(records, filters, students);
    if (existing.length > 0) {
      return attendanceRowsFromRecords(existing);
    }
    return buildDefaultRows(students, customFields);
  });
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

  const studentRosterKey = students.map((student) => `${student.id}-${student.name}`).join("|");
  const stableKey = `${filters.classId}:${filters.sectionId ?? ""}:${filters.date}:${studentRosterKey}`;

  // Rebuild the roster whenever the class/date/roster key changes — during
  // render, so the previous roster is never editable under the new filters.
  // stableKey encodes classId + date + roster, so it is the only input needed.
  const [prevStableKey, setPrevStableKey] = useState(stableKey);
  if (prevStableKey !== stableKey) {
    setPrevStableKey(stableKey);
    if (filters.classId && filters.date) {
      const existing = existingRecordsForRoster(records, filters, students);
      setRows(
        existing.length > 0
          ? attendanceRowsFromRecords(existing)
          : buildDefaultRows(students, customFields),
      );
      setSubmitted(false);
      setIsDraft(false);
      setGeo(null);
      setShowFaceAI(false);
    }
  }

  const filteredRows = (() =>
    rows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase())))();

  const stats = (() => {
    const counts: Record<string, number> = {};
    rows.forEach((row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
    });
    return counts;
  })();

  const setRow = (studentId: string, key: string, value: unknown) => {
    const before = rows.find((row) => row.studentId === studentId);
    setRows((previousRows) =>
      previousRows.map((row) => (row.studentId === studentId ? { ...row, [key]: value } : row)),
    );
    if (filters.classId && filters.date && before) {
      addAuditEntry(filters.classId, filters.date, {
        action: "edit",
        studentId,
        field: key,
        from: String(before[key] ?? ""),
        to: String(value),
        by: role,
      });
    }
  };

  const markAll = (status: AttendanceRecord["status"]) => {
    setRows((previousRows) => previousRows.map((row) => ({ ...row, status })));
    addAuditEntry(filters.classId, filters.date, {
      action: "bulk_mark",
      status,
      count: rows.length,
      by: role,
    });
  };

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
    submitted,
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
  };
}
