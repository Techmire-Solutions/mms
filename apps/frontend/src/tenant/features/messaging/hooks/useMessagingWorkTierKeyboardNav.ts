import { useEffect, useState } from "react";
import type { Message } from "@mms/shared";

interface UseMessagingWorkTierKeyboardNavParams {
  logs: Message[];
  toggleLog: (log: Message, shiftKey?: boolean) => void;
  handleOpenDetail: (log: Message) => void;
}

export function useMessagingWorkTierKeyboardNav({
  logs,
  toggleLog,
  handleOpenDetail,
}: UseMessagingWorkTierKeyboardNavParams): void {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

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
}
