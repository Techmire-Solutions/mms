import { useCallback, useEffect, useRef, useState } from "react";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

/**
 * Keyboard-first row navigation for the roster.
 *
 * The grid previously had no per-row keyboard path: a keyboard user had to tab through every status
 * button of every student. This hook gives the roster a single roving tab stop and keys for moving
 * and marking.
 */

const STATUS_BY_DIGIT: Record<string, AttendanceRecord["status"]> = {
  "1": "present",
  "2": "absent",
  "3": "late",
  "4": "half_day",
  "5": "excused",
};

const STATUS_CYCLE: AttendanceRecord["status"][] = [
  "present",
  "absent",
  "late",
  "half_day",
  "excused",
];

export interface UseRosterRowNavigationOptions {
  enabled: boolean;
  studentIds: readonly string[];
  onSetStatus: (studentId: string, status: AttendanceRecord["status"]) => void;
  onOpenNotes?: (studentId: string) => void;
}

export interface RosterRowNavigation {
  activeStudentId: string | null;
  setActiveStudentId: (studentId: string | null) => void;
  /** Tab index for a row: 0 for the active row (or the first when nothing is active). */
  tabIndexFor: (studentId: string) => number;
  rowRef: (studentId: string) => (node: HTMLElement | null) => void;
}

export function useRosterRowNavigation({
  enabled,
  studentIds,
  onSetStatus,
  onOpenNotes,
}: UseRosterRowNavigationOptions): RosterRowNavigation {
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());

  const focusRow = useCallback((studentId: string) => {
    setActiveStudentId(studentId);
    nodes.current.get(studentId)?.scrollIntoView({ block: "nearest" });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTyping || studentIds.length === 0) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const index = activeStudentId ? studentIds.indexOf(activeStudentId) : -1;
      const current = index >= 0 ? studentIds[index] : undefined;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        // With no cursor yet, either arrow lands on the first row (not the second).
        const nextIndex =
          index < 0
            ? 0
            : Math.min(
                Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0),
                studentIds.length - 1,
              );
        const next = studentIds[nextIndex];
        if (next) focusRow(next);
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const next = event.key === "Home" ? studentIds[0] : studentIds[studentIds.length - 1];
        if (next) focusRow(next);
        return;
      }
      if (!current) return;

      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        const rowIndex = STATUS_CYCLE.indexOf("present");
        // Cycle from the row's current status is handled by the caller via onSetStatus below.
        onSetStatus(current, STATUS_CYCLE[(rowIndex + 1) % STATUS_CYCLE.length]!);
        return;
      }
      const status = STATUS_BY_DIGIT[event.key];
      if (status) {
        event.preventDefault();
        onSetStatus(current, status);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onOpenNotes?.(current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, studentIds, activeStudentId, focusRow, onSetStatus, onOpenNotes]);

  const tabIndexFor = useCallback(
    (studentId: string) => {
      if (studentIds.length === 0) return -1;
      const active = activeStudentId ?? studentIds[0];
      return studentId === active ? 0 : -1;
    },
    [activeStudentId, studentIds],
  );

  const rowRef = useCallback(
    (studentId: string) => (node: HTMLElement | null) => {
      if (node) nodes.current.set(studentId, node);
      else nodes.current.delete(studentId);
    },
    [],
  );

  return { activeStudentId, setActiveStudentId, tabIndexFor, rowRef };
}
