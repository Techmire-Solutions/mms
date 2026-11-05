import React, { useState } from "react";
import type { Message } from "@mms/shared";
import type { MessagingSelectedLogsMap } from "../components/MessagingWorkTier";

interface UseMessagingWorkTierSelectionParams {
  logs: Message[];
  /**
   * Identity of the current view (filters + page + archived flag). A different
   * scope means the previous selection belongs to rows the user can no longer
   * see, so it is dropped (`mms-module-work`).
   */
  scopeKey?: string;
}

const EMPTY_SELECTION: MessagingSelectedLogsMap = {};

interface SelectionState {
  scopeKey: string | undefined;
  byId: MessagingSelectedLogsMap;
}

export function useMessagingWorkTierSelection({
  logs,
  scopeKey,
}: UseMessagingWorkTierSelectionParams) {
  // The scope key travels with the selection instead of being reset from an
  // effect (setState-in-effect is banned): a mismatched scope reads as an empty
  // selection and the next toggle rewrites both.
  const [state, setState] = useState<SelectionState>({ scopeKey, byId: EMPTY_SELECTION });
  const selectedById = state.scopeKey === scopeKey ? state.byId : EMPTY_SELECTION;
  const lastSelectedLogRef = React.useRef<Message | null>(null);

  const setSelectedById = (next: MessagingSelectedLogsMap): void => {
    setState({ scopeKey, byId: next });
  };

  const allVisibleSelected =
    logs.length > 0 && logs.every((log: Message) => Boolean(selectedById[String(log.id)]));
  const someVisibleSelected = logs.some((log: Message) => Boolean(selectedById[String(log.id)]));
  const selectedList = Object.values(selectedById);
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
    logs.forEach((log) => {
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
