import { useEffect, useState } from "react";
import { isOverlayOpen } from "@/lib/ui/keyboardGuards";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { Message } from "@mms/shared";

/** Class used to locate the keyboard-focused row/card for scroll-into-view. */
export const MESSAGING_KB_FOCUS_CLASS = "messaging-kb-focus-row" as const;

interface UseMessagingWorkTierKeyboardNavParams {
  logs: Message[];
  toggleLog: (log: Message, shiftKey?: boolean) => void;
  handleOpenDetail: (log: Message) => void;
}

export function useMessagingWorkTierKeyboardNav({
  logs,
  toggleLog,
  handleOpenDetail,
}: UseMessagingWorkTierKeyboardNavParams): { focusedIndex: number } {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [previousLogs, setPreviousLogs] = useState(logs);
  const reducedMotion = useReducedMotion();

  // Any change to the visible log set invalidates the row index - reset during render.
  if (previousLogs !== logs) {
    setPreviousLogs(logs);
    setFocusedIndex(-1);
  }

  // Keep the focused row visible without jarring scroll jumps.
  useEffect(() => {
    if (focusedIndex < 0) return;
    document
      .querySelector(`.${MESSAGING_KB_FOCUS_CLASS}`)
      ?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }, [focusedIndex, reducedMotion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      // Ignore navigation while a dialog/modal (composer, confirms) owns the keyboard.
      if (isOverlayOpen()) return;

      if (logs.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < logs.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : logs.length - 1));
      } else if (e.key === " " && focusedIndex >= 0 && focusedIndex < logs.length) {
        e.preventDefault();
        const targetLog = logs[focusedIndex];
        if (targetLog) toggleLog(targetLog, e.shiftKey);
      } else if (e.key === "Enter" && focusedIndex >= 0 && focusedIndex < logs.length) {
        e.preventDefault();
        const targetLog = logs[focusedIndex];
        if (targetLog) handleOpenDetail(targetLog);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [logs, focusedIndex, toggleLog, handleOpenDetail]);

  return { focusedIndex };
}
