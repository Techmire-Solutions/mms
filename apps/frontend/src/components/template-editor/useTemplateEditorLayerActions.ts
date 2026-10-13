/**
 * @file useTemplateEditorLayerActions.ts
 * @description Sub-hook providing element z-ordering and layer arrangement operations.
 */

import { useCallback } from "react";
import type { TemplateElement } from "@mms/shared";
import {
  bringSelectedToFront as bringSelectedToFrontUtil,
  sendSelectedToBack as sendSelectedToBackUtil,
} from "./templateEditorUtils";

export interface UseTemplateEditorLayerActionsOptions<TPayload = Record<string, unknown>> {
  selectedId: string | null;
  selectedIds: string[];
  commitUpdate: (
    updateFn: (
      elements: TemplateElement<keyof TPayload & string>[],
    ) => TemplateElement<keyof TPayload & string>[],
  ) => void;
}

export function useTemplateEditorLayerActions<TPayload = Record<string, unknown>>({
  selectedId,
  selectedIds,
  commitUpdate,
}: UseTemplateEditorLayerActionsOptions<TPayload>) {
  const bringToFront = useCallback(
    (elementId?: string) => {
      const targetId = elementId || selectedId;
      if (!targetId) return;
      commitUpdate((els) => {
        const idx = els.findIndex((el) => el.id === targetId);
        if (idx === -1 || idx === els.length - 1) return els;
        const copy = [...els];
        const [item] = copy.splice(idx, 1);
        if (item) copy.push(item);
        return copy;
      });
    },
    [commitUpdate, selectedId],
  );

  const sendToBack = useCallback(
    (elementId?: string) => {
      const targetId = elementId || selectedId;
      if (!targetId) return;
      commitUpdate((els) => {
        const idx = els.findIndex((el) => el.id === targetId);
        if (idx <= 0) return els;
        const copy = [...els];
        const [item] = copy.splice(idx, 1);
        if (item) copy.unshift(item);
        return copy;
      });
    },
    [commitUpdate, selectedId],
  );

  const bringSelectedToFront = useCallback(() => {
    if (selectedIds.length === 0) return;
    commitUpdate((els) => bringSelectedToFrontUtil(els, selectedIds));
  }, [commitUpdate, selectedIds]);

  const sendSelectedToBack = useCallback(() => {
    if (selectedIds.length === 0) return;
    commitUpdate((els) => sendSelectedToBackUtil(els, selectedIds));
  }, [commitUpdate, selectedIds]);

  const moveForward = useCallback(
    (elementId?: string) => {
      const targetId = elementId || selectedId;
      if (!targetId) return;
      commitUpdate((els) => {
        const idx = els.findIndex((el) => el.id === targetId);
        if (idx === -1 || idx === els.length - 1) return els;
        const copy = [...els];
        const temp = copy[idx]!;
        copy[idx] = copy[idx + 1]!;
        copy[idx + 1] = temp;
        return copy;
      });
    },
    [commitUpdate, selectedId],
  );

  const moveBackward = useCallback(
    (elementId?: string) => {
      const targetId = elementId || selectedId;
      if (!targetId) return;
      commitUpdate((els) => {
        const idx = els.findIndex((el) => el.id === targetId);
        if (idx <= 0) return els;
        const copy = [...els];
        const temp = copy[idx]!;
        copy[idx] = copy[idx - 1]!;
        copy[idx - 1] = temp;
        return copy;
      });
    },
    [commitUpdate, selectedId],
  );

  return {
    bringToFront,
    sendToBack,
    bringSelectedToFront,
    sendSelectedToBack,
    moveForward,
    moveBackward,
  };
}
