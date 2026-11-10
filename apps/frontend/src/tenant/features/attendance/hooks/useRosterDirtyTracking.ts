import { useEffect, useMemo } from "react";
import type { RefObject } from "react";
import type { AttendanceRow } from "@/tenant/features/attendance/lib/markAttendanceTypes";
import {
  rowMatchesBaseline,
  type RowBaseline,
} from "@/tenant/features/attendance/lib/markAttendanceRowState";

/**
 * Dirty tracking for the marking grid.
 *
 * Dirtiness is "any row's persisted fields differ from the baseline" — audit-log entries alone never
 * make the grid dirty. The result drives the tab-close guard and the page-level class/date/tier guard.
 */
export function useRosterDirtyTracking(args: {
  rows: AttendanceRow[];
  baseline: RefObject<Map<string, RowBaseline>>;
  onDirtyChange?: (dirty: boolean) => void;
}): boolean {
  const { rows, baseline, onDirtyChange } = args;
  const isDirty = useMemo(
    () => rows.some((row) => !rowMatchesBaseline(row, baseline.current.get(row.studentId))),
    [rows, baseline],
  );
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  return isDirty;
}
