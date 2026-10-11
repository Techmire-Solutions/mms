/**
 * @file useTemplateEditorClipboard.ts
 * @description Sub-hook providing clipboard copy and paste operations with offset and bounds clamping.
 */

import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import type { PageSizeInfo, TemplateElement } from "@mms/shared";
import { newId } from "./templateEditorUtils";

export interface UseTemplateEditorClipboardOptions<TPayload = Record<string, unknown>> {
  elements: TemplateElement<keyof TPayload & string>[];
  selectedSet: Set<string>;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  commitUpdate: (
    updateFn: (
      elements: TemplateElement<keyof TPayload & string>[],
    ) => TemplateElement<keyof TPayload & string>[],
  ) => void;
  size: PageSizeInfo;
}

export function useTemplateEditorClipboard<TPayload = Record<string, unknown>>({
  elements,
  selectedSet,
  selectedIds,
  setSelectedIds,
  commitUpdate,
  size,
}: UseTemplateEditorClipboardOptions<TPayload>) {
  const clipboardRef = useRef<TemplateElement<keyof TPayload & string>[]>([]);

  const copySelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const toCopy = elements.filter((el) => selectedSet.has(el.id));
    if (toCopy.length > 0) {
      clipboardRef.current = toCopy;
    }
  }, [elements, selectedIds.length, selectedSet]);

  const paste = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    const newElements: TemplateElement<keyof TPayload & string>[] = [];
    const newIds: string[] = [];
    for (const el of clipboardRef.current) {
      const id = newId();
      newIds.push(id);
      const nextX = el.x + 16;
      const nextY = el.y + 16;
      const clampedX = nextX + el.w > size.width ? Math.max(0, size.width - el.w - 16) : nextX;
      const clampedY = nextY + el.h > size.height ? Math.max(0, size.height - el.h - 16) : nextY;
      newElements.push({
        ...el,
        id,
        x: clampedX,
        y: clampedY,
        style: el.style ? { ...el.style } : undefined,
        columns: el.columns ? el.columns.map((col) => ({ ...col })) : undefined,
        tableConfig: el.tableConfig ? { ...el.tableConfig } : undefined,
      });
    }
    commitUpdate((curr) => [...curr, ...newElements]);
    setSelectedIds(newIds);
  }, [commitUpdate, setSelectedIds, size.height, size.width]);

  return {
    copySelected,
    paste,
  };
}
