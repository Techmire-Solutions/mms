import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import type { AttendanceFilterState } from "@/tenant/features/attendance/components/AttendanceFilters";

/**
 * The attendance query-key factory.
 *
 * Every key lives under the single `["attendance"]` root so one invalidation covers the list, the
 * roster, metrics, report aggregates, lifecycle, lookups, preferences and coverage. Keys used to be
 * scattered literals (and some were rooted at `attendance_records`), which is how the marking grid
 * ended up invalidating the list but not its own roster.
 */

const ROOT = "attendance" as const;

export const attendanceQueryKeys = {
  /** Everything attendance owns. Invalidate this after any attendance mutation. */
  all: [ROOT] as const,
  list: [ROOT, "list"] as const,
  listPage: (params: unknown) => [ROOT, "list", "page", params] as const,
  roster: (filters: Pick<AttendanceFilterState, "classId" | "date" | "sectionId">) =>
    [
      ROOT,
      "roster",
      filters.classId?.trim() ?? "",
      filters.date?.trim() ?? "",
      filters.sectionId?.trim() ?? "",
    ] as const,
  metrics: [ROOT, "metrics"] as const,
  reportAggregates: [ROOT, "report-aggregates"] as const,
  lifecycle: [ROOT, "lifecycle"] as const,
  leaves: [ROOT, "lifecycle", "leaves"] as const,
  alerts: [ROOT, "lifecycle", "alerts"] as const,
  markedDates: [ROOT, "marked-dates"] as const,
  lookups: [ROOT, "lookups"] as const,
  preferences: [ROOT, "preferences"] as const,
  daySubmission: (classId: string, date: string) =>
    [ROOT, "day-submission", classId?.trim() ?? "", date?.trim() ?? ""] as const,
} as const;

/** Legacy named exports (kept so existing imports keep working — all point at the factory). */
export const ATTENDANCE_QUERY_KEY = attendanceQueryKeys.list;
export const ATTENDANCE_METRICS_QUERY_KEY = attendanceQueryKeys.metrics;
export const ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY = attendanceQueryKeys.reportAggregates;

/** Kept for modules that only need the collection name (reports widget snapshots). */
export const ATTENDANCE_COLLECTION_KEY = ATTENDANCE_MODULE_MANIFEST.collectionKey;
