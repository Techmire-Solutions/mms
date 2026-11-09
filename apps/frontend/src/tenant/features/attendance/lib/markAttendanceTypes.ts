import type { ReactNode } from "react";
import type { ModuleFieldDef } from "@mms/shared";
import type { AttendanceFilterState } from "@/tenant/features/attendance/components/AttendanceFilters";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

export interface GeoData {
  lat: number;
  lng: number;
}

export interface AttendanceRow {
  studentId: string;
  name: string;
  rollNo: string;
  status: AttendanceRecord["status"];
  timeIn: string;
  timeOut: string;
  notes: string;
  /** Server row id, when this row already exists (drives the upsert + OCC token). */
  recordId?: string;
  /** Optimistic-concurrency token echoed back on save; absent for a brand-new mark. */
  version?: number;
  [key: string]: unknown;
}

export interface OfflinePayload {
  classId: string;
  date: string;
  rows: AttendanceRow[];
  geo: GeoData | null;
  submittedBy: string;
  ts: string;
}

export interface AuditEntry {
  action: string;
  ts?: string;
  studentId?: string;
  studentName?: string;
  field?: string;
  from?: string;
  to?: string;
  by?: string;
  status?: string;
  count?: number;
  geo?: GeoData | null;
}

export interface MarkAttendanceProps {
  filters: AttendanceFilterState;
  role: string;
  records: AttendanceRecord[];
  /** Saves the roster; resolves with the persisted rows (server ids + OCC versions). */
  persistBatch: (
    records: AttendanceRecord[],
    overrideReason?: string,
  ) => Promise<AttendanceRecord[]>;
  /** Called instead of the error toast when the API demands a justification for an override. */
  onOverrideRequired?: (
    records: AttendanceRecord[],
    retry: (reason: string) => Promise<void>,
  ) => void;
  /** Reports whether the roster has unsaved edits (drives the navigation guards). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Locks the roster day after a successful submit (server-side day submission). */
  onSubmitDay?: (classId: string, date: string) => Promise<unknown>;
  /** Delete-level reopen of a submitted day. */
  onReopenDay?: (classId: string, date: string, reason?: string) => Promise<unknown>;
  /** True when the user may reopen a locked day. */
  canReopenDay?: boolean;
}

export type AttendanceFieldControlRenderer = (
  row: AttendanceRow,
  field: ModuleFieldDef,
  idPrefix: string,
) => ReactNode;
