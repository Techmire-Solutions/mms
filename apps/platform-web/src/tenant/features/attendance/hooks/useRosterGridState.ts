import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AttendanceRecord, ClassStudent } from "@/lib/data/attendanceData";
import type { ModuleCustomField } from "@mms/contracts";
import type { AttendanceRow } from "@/tenant/features/attendance/lib/markAttendanceTypes";
import {
  applyPersistedRows,
  baselineOf,
  mergeServerRows,
  rowSignature,
  seedRowsFor,
  type RowBaseline,
} from "@/tenant/features/attendance/lib/markAttendanceRowState";
import { existingRecordsForRoster } from "@/tenant/features/attendance/lib/markAttendanceRowUtils";

/**
 * Rows + dirty baseline + conflict count in ONE state object so every mutation is a pure functional
 * update (no ref writes during render, no setState inside another setState updater). The baseline is
 * seeded with the rows themselves, so a freshly seeded grid is clean and the navigation guards only
 * engage after a real edit.
 */
export interface RosterGrid {
  rows: AttendanceRow[];
  baseline: Map<string, RowBaseline>;
  conflicts: number;
}

export interface UseRosterGridStateArgs {
  filters: { classId: string; date: string; sectionId?: string };
  records: AttendanceRecord[];
  students: ClassStudent[];
  customFields: ModuleCustomField[];
  /** Changes when the roster (class/date/section/students) changes; triggers a render-phase reseed. */
  rosterKey: string;
}

function gridOf(nextRows: AttendanceRow[]): RosterGrid {
  return {
    rows: nextRows,
    baseline: new Map(nextRows.map((row) => [row.studentId, baselineOf(row)])),
    conflicts: 0,
  };
}

/**
 * Marking-grid state: seeding, server-snapshot merging and post-save adoption.
 *
 * Both the roster reseed and the server merge run as render-phase state adjustments (guarded by
 * value-compared keys/signatures), which keeps the grid compiler-clean and free of set-state-in-effect
 * cascades. `mergeServerRows` is idempotent, so re-renders with unchanged inputs do nothing.
 */
export function useRosterGridState({
  filters,
  records,
  students,
  customFields,
  rosterKey,
}: UseRosterGridStateArgs): {
  grid: RosterGrid;
  setGrid: Dispatch<SetStateAction<RosterGrid>>;
  rows: AttendanceRow[];
  seedRows: (nextRows: AttendanceRow[]) => void;
  applyPersisted: (persisted: AttendanceRecord[]) => void;
  /** True on the render that reseeded the grid (the caller resets its derived flags). */
  reseeded: boolean;
} {
  const [grid, setGrid] = useState<RosterGrid>(() =>
    !filters.classId || !filters.date
      ? gridOf([])
      : gridOf(seedRowsFor({ records, filters, students, customFields })),
  );

  // Rebuild during render when the roster changes, so the old roster is never editable under the
  // new filters (rosterKey is the only input needed).
  const [prevRosterKey, setPrevRosterKey] = useState(rosterKey);
  const reseeded = prevRosterKey !== rosterKey;
  if (reseeded) {
    setPrevRosterKey(rosterKey);
    if (filters.classId && filters.date) {
      setGrid(gridOf(seedRowsFor({ records, filters, students, customFields })));
    }
  }

  // Adopt server changes (refetch after save, stale-write recovery, another instructor's save)
  // without clobbering edited rows: clean rows take the server value, dirty rows keep their edits
  // and drop the OCC token. The signature is value-compared, so parents recreating `records` with
  // identical content never re-trigger the merge.
  const recordsSignature = existingRecordsForRoster(records, filters, students)
    .map((record) => rowSignature(record))
    .join("|");
  const [prevSignature, setPrevSignature] = useState(recordsSignature);
  if (!reseeded && prevSignature !== recordsSignature) {
    setPrevSignature(recordsSignature);
    if (filters.classId && filters.date && recordsSignature) {
      const serverRecords = existingRecordsForRoster(records, filters, students);
      const nextBaseline = new Map(grid.baseline);
      const result = mergeServerRows({
        currentRows: grid.rows,
        serverRecords,
        baseline: nextBaseline,
      });
      const conflicts =
        result.conflicts > 0 && grid.conflicts !== result.conflicts
          ? result.conflicts
          : grid.conflicts;
      if (result.changed || conflicts !== grid.conflicts) {
        setGrid({ rows: result.rows, baseline: nextBaseline, conflicts });
      }
    }
  }

  const seedRows = (nextRows: AttendanceRow[]): void => setGrid(gridOf(nextRows));

  /** Adopts the server's persisted rows after a save (ids + versions) and clears the conflicts. */
  const applyPersisted = (persisted: AttendanceRecord[]): void => {
    if (persisted.length === 0) return;
    setGrid((current) => {
      const nextBaseline = new Map(current.baseline);
      return {
        rows: applyPersistedRows({
          currentRows: current.rows,
          persisted,
          baseline: nextBaseline,
        }),
        baseline: nextBaseline,
        conflicts: 0,
      };
    });
  };

  return { grid, setGrid, rows: grid.rows, seedRows, applyPersisted, reseeded };
}
