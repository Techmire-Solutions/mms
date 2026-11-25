import { useEffect } from "react";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

export interface UseMarkAttendanceKeyboardShortcutsOptions {
  enabled: boolean;
  canWrite: boolean;
  onMarkAll: (status: AttendanceRecord["status"]) => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

const MASS_MARK_KEYS: Record<string, AttendanceRecord["status"]> = {
  p: "present",
  a: "absent",
  l: "late",
  h: "half_day",
  e: "excused",
};

/**
 * Keyboard shortcuts for rapid attendance marking:
 * - Cmd/Ctrl + S: Save draft
 * - Cmd/Ctrl + Enter: Submit attendance (ignored while typing in a field)
 * - Alt + P/A/L/H/E: Mark all present/absent/late/half day/excused
 *
 * **Alt is required** for the mass actions. The old handler accepted `e.altKey || e.shiftKey`, so
 * typing a shifted P/A/L after clicking a cell marked the whole class — an unrecoverable mis-click.
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
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSaveDraft();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        // Submitting mid-sentence in the notes field is never intended.
        if (isInput) return;
        e.preventDefault();
        onSubmit();
        return;
      }

      if (isInput) return;
      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      const status = MASS_MARK_KEYS[e.key.toLowerCase()];
      if (!status) return;
      e.preventDefault();
      onMarkAll(status);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, canWrite, onMarkAll, onSaveDraft, onSubmit]);
}
