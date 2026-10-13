import React, { useState } from "react";
import type { Message } from "@mms/shared";
import type { MessagingSelectedLogsMap } from "./MessagingWorkTier";

interface UseMessagingWorkTierSelectionParams {
  logs: Message[];
}

export function useMessagingWorkTierSelection({ logs }: UseMessagingWorkTierSelectionParams) {
  const [selectedById, setSelectedById] = useState<MessagingSelectedLogsMap>({});
  const lastSelectedLogRef = React.useRef<Message | null>(null);

  const allVisibleSelected =
    logs.length > 0 && logs.every((log: Message) => Boolean(selectedById[String(log.id)]));
  const someVisibleSelected = logs.some((log: Message) => Boolean(selectedById[String(log.id)]));
  const selectedList = (() => Object.values(selectedById))();
  const selectedCount = selectedList.length;

  const toggleLog = (log: Message, shiftKey?: boolean): void => {
    const key = String(log.id);
    const isCurrentlySelected = Boolean(selectedById[key]);

    if (shiftKey && lastSelectedLogRef.current) {
      const lastIndex = logs.findIndex(
        (l: Message) => String(l.id) === String(lastSelectedLogRef.current?.id),
      );
      const currentIndex = logs.findIndex((l: Message) => String(l.id) === key);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const next = { ...selectedById };

        for (let i = start; i <= end; i++) {
          const item = logs[i];
          if (item) {
            next[String(item.id)] = item;
          }
        }
        setSelectedById(next);
        return;
      }
    }

    lastSelectedLogRef.current = isCurrentlySelected ? null : log;
    const next = { ...selectedById };
    if (next[key]) delete next[key];
    else next[key] = log;
    setSelectedById(next);
  };

  const toggleAllVisible = (checked: boolean): void => {
    const next = { ...selectedById };
    logs.forEach((log: Message) => {
      const key = String(log.id);
      if (checked) next[key] = log;
      else delete next[key];
    });
    setSelectedById(next);
  };

  return {
    selectedById,
    setSelectedById,
    allVisibleSelected,
    someVisibleSelected,
    selectedList,
    selectedCount,
    toggleLog,
    toggleAllVisible,
  };
}
