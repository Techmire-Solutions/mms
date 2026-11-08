import type {
  AttendanceRecord,
  AttendanceListQuery,
  AttendanceListPageResult,
  AttendanceCommandMetricsSnapshot,
  AttendanceReportAggregates,
  AttendanceMarkedDatesQuery,
  AttendanceReportAggregatesQuery,
  WidgetQuery,
  WidgetAggregateResult,
} from "@mms/shared";

/**
 * Sole storage gateway for the attendance module.
 *
 * Mirrors the `contacts`/`sessions`/`enrollments`/`finance` reference pattern:
 * routes and use-cases depend on this interface (never on Drizzle directly), and
 * the Drizzle-backed adapter is the only implementation. Tests can inject a fake
 * repository at the seam.
 */
export interface AttendanceRepository {
  listAttendanceRecordsByWorkspace(tenant: string): Promise<AttendanceRecord[]>;
  findAttendanceRecordById(tenant: string, id: string): Promise<AttendanceRecord | null>;
  findAttendanceRecordsByIds(tenant: string, ids: string[]): Promise<AttendanceRecord[]>;
  /**
   * Live rows of the given students on the given days — one query for the roster-save
   * policy/audit diff.
   */
  findAttendanceRecordsForStudentsOnDates(
    tenant: string,
    studentIds: string[],
    days: string[],
  ): Promise<AttendanceRecord[]>;
  saveAttendanceRecord(tenant: string, record: AttendanceRecord): Promise<void>;
  /**
   * Updates the row addressed by `record.id`, including a changed business key (moving a mark to
   * another day or class). Returns `null` when the row is missing or archived; throws 409 on a
   * stale `version` or a key collision.
   */
  saveAttendanceRecordById(
    tenant: string,
    record: AttendanceRecord,
  ): Promise<AttendanceRecord | null>;
  /**
   * Upserts a marked roster and returns the rows as persisted.
   *
   * The persisted shape matters: the natural-key upsert may update an existing row (keeping its
   * `id` and advancing its `version`), so echoing the request body would hand the client stale ids
   * and OCC tokens.
   */
  bulkSaveAttendanceRecords(
    tenant: string,
    records: AttendanceRecord[],
  ): Promise<AttendanceRecord[]>;
  replaceAttendanceRecordsForWorkspace(tenant: string, records: AttendanceRecord[]): Promise<void>;
  listAttendancePage(tenant: string, query: AttendanceListQuery): Promise<AttendanceListPageResult>;
  countAttendanceActiveByWorkspace(tenant: string): Promise<number>;
  aggregateAttendanceCommandMetrics(
    tenant: string,
    options?: { selectedDate?: string; periodDays?: number },
  ): Promise<AttendanceCommandMetricsSnapshot>;
  aggregateAttendanceWidgetQueries(
    tenant: string,
    queries: WidgetQuery[],
  ): Promise<Record<string, WidgetAggregateResult>>;
  loadAttendanceReportAggregates(
    tenant: string,
    query?: AttendanceReportAggregatesQuery,
  ): Promise<AttendanceReportAggregates>;
  listMarkedAttendanceDates(tenant: string, query: AttendanceMarkedDatesQuery): Promise<string[]>;
  bulkSoftDeleteAttendanceRecords?(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreAttendanceRecords?(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;
}
