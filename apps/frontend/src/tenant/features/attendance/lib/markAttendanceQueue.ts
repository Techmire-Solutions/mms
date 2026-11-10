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

/**
 * Buffered audit writes.
 *
 * The grid used to call `addAuditEntry` on every field change — a synchronous `JSON.parse` +
 * `JSON.stringify` + `localStorage.setItem` for **each keystroke** in a notes cell. Entries are now
 * buffered and flushed once per burst (idle callback, on save, on unmount), so rapid entry stays on
 * the main thread's fast path while the audit trail loses nothing.
 */
const pendingAudit = new Map<string, AuditEntry[]>();
let flushScheduled = false;

function auditKeyOf(classId: string, date: string): string {
  return auditStorageKey(classId, date);
}

function flushPendingAudit(): void {
  flushScheduled = false;
  for (const [key, entries] of pendingAudit) {
    if (entries.length === 0) continue;
    try {
      const existing = JSON.parse(localStorage.getItem(key) || "[]") as AuditEntry[];
      const merged = [...entries.reverse(), ...existing].slice(0, 50);
      localStorage.setItem(key, JSON.stringify(merged));
    } catch (error) {
      reportClientError(error, { context: "attendance.flushAuditLog" });
    }
  }
  pendingAudit.clear();
}

function scheduleAuditFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (typeof idle === "function") {
    idle(flushPendingAudit);
    return;
  }
  setTimeout(flushPendingAudit, 1000);
}

/** Buffers an audit entry; the write happens once per burst. */
export function queueAuditEntry(classId: string, date: string, entry: AuditEntry): void {
  const key = auditKeyOf(classId, date);
  const list = pendingAudit.get(key) ?? [];
  list.push({ ...entry, ts: new Date().toISOString() });
  pendingAudit.set(key, list);
  scheduleAuditFlush();
}

/** Flushes buffered entries immediately (called on save and unmount). */
export function flushAuditQueue(): void {
  flushPendingAudit();
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
