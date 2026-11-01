/**
 * @file useTemplateEditorElementActions.ts
 * @description Hook providing element lifecycle operations: add, delete, duplicate, layer, nudge, and patch.
 */

import { useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { ElementStyle, PageSizeInfo, TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { useTemplateEditorAlignActions } from "./useTemplateEditorAlignActions";
import { useTemplateEditorLayerActions } from "./useTemplateEditorLayerActions";
import { useTemplateEditorAddActions } from "./useTemplateEditorAddActions";
import { useTemplateEditorDuplicateActions } from "./useTemplateEditorDuplicateActions";
import { useTemplateEditorBatchTransformActions } from "./useTemplateEditorBatchTransformActions";
import { clampElementBox } from "./templateEditorBounds";

export interface UseTemplateEditorElementActionsOptions<TPayload = Record<string, unknown>> {
  elements: TemplateElement<keyof TPayload & string>[];
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  commitUpdate: (
    updateFn: (
      elements: TemplateElement<keyof TPayload & string>[],
    ) => TemplateElement<keyof TPayload & string>[],
  ) => void;
  commitUpdateCoalesced: (
    coalesceKey: string,
    updateFn: (
      elements: TemplateElement<keyof TPayload & string>[],
    ) => TemplateElement<keyof TPayload & string>[],
  ) => void;
  size: PageSizeInfo;
  onElementAdded?: (elementId: string) => void;
  onElementDeleted?: (deletedCount: number) => void;
  t: TranslationFunction;
}

export function useTemplateEditorElementActions<TPayload = Record<string, unknown>>({
  elements,
  selectedIds,
  setSelectedIds,
  commitUpdate,
  commitUpdateCoalesced,
  size,
  onElementAdded,
  onElementDeleted,
  t,
}: UseTemplateEditorElementActionsOptions<TPayload>) {
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const selectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;

  const selectElement = useCallback(
    (elementId: string) => {
      setSelectedIds([elementId]);
    },
    [setSelectedIds],
  );

  const patchElement = useCallback(
    (elementId: string, patch: Partial<TemplateElement<keyof TPayload & string>>) => {
      const keys = Object.keys(patch).join(",");
      commitUpdateCoalesced(`patch:${elementId}:${keys}`, (els) =>
        els.map((el) => (el.id === elementId ? clampElementBox({ ...el, ...patch }, size) : el)),
      );
    },
    [commitUpdateCoalesced, size],
  );

  const patchStyle = useCallback(
    (elementId: string, stylePatch: Partial<ElementStyle>) => {
      const keys = Object.keys(stylePatch).join(",");
      commitUpdateCoalesced(`style:${elementId}:${keys}`, (els) =>
        els.map((el) =>
          el.id === elementId ? { ...el, style: { ...el.style, ...stylePatch } } : el,
        ),
      );
    },
    [commitUpdateCoalesced],
  );

  const deleteElement = useCallback(
    (elementId: string) => {
      commitUpdate((els) => els.filter((el) => el.id !== elementId));
      setSelectedIds((prev) => prev.filter((id) => id !== elementId));
      onElementDeleted?.(1);
    },
    [commitUpdate, onElementDeleted, setSelectedIds],
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    commitUpdate((els) => els.filter((el) => !idSet.has(el.id)));
    setSelectedIds([]);
    onElementDeleted?.(selectedIds.length);
  }, [commitUpdate, onElementDeleted, selectedIds, setSelectedIds]);

  const { nudgeSelected, resizeSelected, patchSelectedStyles } =
    useTemplateEditorBatchTransformActions<TPayload>({
      selectedIds,
      size,
      commitUpdateCoalesced,
    });

  const { duplicateElement, duplicateSelected } = useTemplateEditorDuplicateActions<TPayload>({
    elementsRef,
    commitUpdate,
    size,
    onElementAdded,
    selectedIds,
    setSelectedIds,
  });

  const alignActions = useTemplateEditorAlignActions<TPayload>({
    selectedIds,
    commitUpdate,
    size,
  });

  const layerActions = useTemplateEditorLayerActions<TPayload>({
    selectedId,
    selectedIds,
    commitUpdate,
  });

  const addActions = useTemplateEditorAddActions<TPayload>({
    elementsRef,
    setSelectedIds,
    commitUpdate,
    size,
    onElementAdded,
    t,
  });

  return useMemo(
    () => ({
      selectElement,
      patchElement,
      patchStyle,
      patchSelectedStyles,
      deleteElement,
      deleteSelected,
      nudgeSelected,
      resizeSelected,
      duplicateElement,
      duplicateSelected,
      ...layerActions,
      ...alignActions,
      ...addActions,
    }),
    [
      selectElement,
      patchElement,
      patchStyle,
      patchSelectedStyles,
      deleteElement,
      deleteSelected,
      nudgeSelected,
      resizeSelected,
      duplicateElement,
      duplicateSelected,
      layerActions,
      alignActions,
      addActions,
    ],
  );
}
