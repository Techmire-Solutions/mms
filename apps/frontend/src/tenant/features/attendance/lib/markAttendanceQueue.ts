import type {
  AuditEntry,
  OfflinePayload,
} from "@/tenant/features/attendance/lib/markAttendanceTypes";
import { reportClientError, reportClientWarn } from "@/lib/clientErrorReporting";

export const ATTENDANCE_OFFLINE_QUEUE_KEY = "att_offline_queue";
export const ATTENDANCE_AUDIT_KEY_PREFIX = "att_audit";

function auditStorageKey(classId: string, date: string): string {
  return `${ATTENDANCE_AUDIT_KEY_PREFIX}_${classId}_${date}`;
}

export function loadQueue(): OfflinePayload[] {
  try {
    return JSON.parse(
      localStorage.getItem(ATTENDANCE_OFFLINE_QUEUE_KEY) || "[]",
    ) as OfflinePayload[];
  } catch (error) {
    reportClientWarn(error, { context: "attendance.loadQueue" });
    return [];
  }
}

export function saveQueue(queue: OfflinePayload[]): void {
  try {
    localStorage.setItem(ATTENDANCE_OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    reportClientError(error, { context: "attendance.saveQueue" });
  }
}

export function addAuditEntry(classId: string, date: string, entry: AuditEntry): void {
  try {
    const key = auditStorageKey(classId, date);
    const existing = JSON.parse(localStorage.getItem(key) || "[]") as AuditEntry[];
    existing.unshift({ ...entry, ts: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
  } catch (error) {
    reportClientError(error, { context: "attendance.addAuditEntry" });
  }
}

/**
 * Retrieves the audit log of attendance changes for a specific class and date.
 */
export function getAuditLog(classId: string, date: string): AuditEntry[] {
  try {
    const key = auditStorageKey(classId, date);
    return JSON.parse(localStorage.getItem(key) || "[]") as AuditEntry[];
  } catch (error) {
    reportClientError(error, { context: "attendance.getAuditLog" });
    return [];
  }
}
