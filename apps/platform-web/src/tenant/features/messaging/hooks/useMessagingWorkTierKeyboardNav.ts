import { useEffect, useState } from "react";
import { isOverlayOpen } from "@mms/fe-core/lib/keyboardGuards";
import { useReducedMotion } from "@mms/fe-core/tenant";
import type { Message } from "@mms/contracts";

/** Class used to locate the keyboard-focused row/card for scroll-into-view. */
export const MESSAGING_KB_FOCUS_CLASS = "messaging-kb-focus-row" as const;

interface UseMessagingWorkTierKeyboardNavParams {
  logs: Message[];
  toggleLog: (log: Message, shiftKey?: boolean) => void;
  handleOpenDetail: (log: Message) => void;
}

/** Focus travels with the log set it belongs to (the selection hook's scope pattern). */
interface KeyboardFocusState {
  logs: Message[];
  focusedLogId: string | null;
}

export function useMessagingWorkTierKeyboardNav({
  logs,
  toggleLog,
  handleOpenDetail,
}: UseMessagingWorkTierKeyboardNavParams): { focusedIndex: number } {
  // Focus is scoped to the visible log set: a replaced set reads as no focus
  // (-1) and the next key press rewrites both. This derives during render
  // instead of resetting state from an effect or mid-render (compiler-safe).
  const [focus, setFocus] = useState<KeyboardFocusState>({ logs, focusedLogId: null });
  const reducedMotion = useReducedMotion();

  const focusedIndex =
    focus.logs === logs ? logs.findIndex((log) => String(log.id) === focus.focusedLogId) : -1;

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
        const nextIndex =
          focusedIndex >= 0 && focusedIndex < logs.length - 1 ? focusedIndex + 1 : 0;
        const nextLog = logs[nextIndex];
        if (nextLog) setFocus({ logs, focusedLogId: String(nextLog.id) });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const nextIndex = focusedIndex > 0 ? focusedIndex - 1 : logs.length - 1;
        const nextLog = logs[nextIndex];
        if (nextLog) setFocus({ logs, focusedLogId: String(nextLog.id) });
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
