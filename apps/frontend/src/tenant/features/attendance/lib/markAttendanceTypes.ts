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
  persistBatch: (records: AttendanceRecord[]) => Promise<void>;
}

export type AttendanceFieldControlRenderer = (
  row: AttendanceRow,
  field: ModuleFieldDef,
  idPrefix: string,
) => ReactNode;
