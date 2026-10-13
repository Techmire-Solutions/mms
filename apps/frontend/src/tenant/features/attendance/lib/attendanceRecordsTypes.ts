import type { AttendanceRecord } from "@/lib/data/attendanceData";
import type { ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";
import type { AttendanceFilterState } from "@/tenant/features/attendance/components/AttendanceFilters";

export const ALWAYS_COLUMN_VISIBLE = (_key: string): boolean => true;
export const ATTENDANCE_COLUMN_KEYS = [
  "date",
  "class",
  "session",
  "student",
  "status",
  "timeIn",
  "timeOut",
  "notes",
] as const;
export const ATTENDANCE_SEARCH_DEBOUNCE_MS = 300;

export interface AttendanceRecordsProps {
  filters: AttendanceFilterState;
  onUpdateRecord: (record: AttendanceRecord) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onRestoreRecord: (id: string) => Promise<void>;
  onBulkDeleteRecords: (ids: string[]) => Promise<void>;
  onBulkRestoreRecords: (ids: string[]) => Promise<void>;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
  isColumnVisible?: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  onMessage?: (channel: "sms" | "whatsapp" | "email", records: AttendanceRecord[]) => void;
  /** Reports the server-filtered total up to the page metrics strip. */
  onTotalChange?: (total: number) => void;
}
