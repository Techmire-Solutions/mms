import { useEffect } from "react";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

export interface UseMarkAttendanceKeyboardShortcutsOptions {
  enabled: boolean;
  canWrite: boolean;
  onMarkAll: (status: AttendanceRecord["status"]) => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

/**
 * Keyboard shortcuts for rapid attendance marking:
 * - Cmd/Ctrl + S: Save draft
 * - Cmd/Ctrl + Enter: Submit attendance
 * - Alt/Shift + P: Mark all present
 * - Alt/Shift + A: Mark all absent
 * - Alt/Shift + L: Mark all late
 */
export function useMarkAttendanceKeyboardShortcuts({
  enabled,
  canWrite,
  onMarkAll,
  onSaveDraft,
  onSubmit,
}: UseMarkAttendanceKeyboardShortcutsOptions): void {
  useEffect(() => {
    if (!enabled || !canWrite) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSaveDraft();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmit();
        return;
      }

      if (isInput) return;

      if (e.altKey || e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === "p") {
          e.preventDefault();
          onMarkAll("present");
        } else if (key === "a") {
          e.preventDefault();
          onMarkAll("absent");
        } else if (key === "l") {
          e.preventDefault();
          onMarkAll("late");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, canWrite, onMarkAll, onSaveDraft, onSubmit]);
}
