import { useState, useMemo, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import type { DocumentTemplate, TemplateElement } from "@mms/shared";
import type { DragStateInfo, ResizeHandle, ResizeStateInfo } from "./useTemplateEditorInteractions";

export interface UseTemplateEditorElementSelectionOptions<TPayload> {
  elements: TemplateElement<keyof TPayload & string>[];
  canvasRef: React.RefObject<HTMLDivElement | null>;
  dragState: React.MutableRefObject<DragStateInfo<TPayload> | null>;
  resizeState: React.MutableRefObject<ResizeStateInfo<TPayload> | null>;
  template: DocumentTemplate<TPayload>;
}

export function useTemplateEditorElementSelection<TPayload>({
  elements,
  canvasRef,
  dragState,
  resizeState,
  template,
}: UseTemplateEditorElementSelectionOptions<TPayload>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedId = useMemo(
    () => (selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null),
    [selectedIds],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedElements = useMemo(
    () => elements.filter((el) => selectedSet.has(el.id)),
    [elements, selectedSet],
  );
  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedId),
    [elements, selectedId],
  );

  const setSelectedId = useCallback((id: string | null) => setSelectedIds(id ? [id] : []), []);
  const deselectAll = useCallback(() => setSelectedIds([]), []);
  const selectAll = useCallback(() => setSelectedIds(elements.map((el) => el.id)), [elements]);

  const onMouseDownElement = useCallback(
    (event: ReactMouseEvent, elementId: string) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (!canvasRef.current) return;

      const isMulti = event.shiftKey || event.metaKey || event.ctrlKey;
      let activeIds = selectedIds;
      if (isMulti) {
        activeIds = selectedSet.has(elementId)
          ? selectedIds.filter((id) => id !== elementId)
          : [...selectedIds, elementId];
        setSelectedIds(activeIds);
      } else if (!selectedSet.has(elementId)) {
        activeIds = [elementId];
        setSelectedIds(activeIds);
      }

      const activeIdSet = new Set(activeIds);
      const itemsToDrag = template.elements
        .filter((el) => activeIdSet.has(el.id))
        .map((el) => ({ id: el.id, origX: el.x, origY: el.y }));
      dragState.current = {
        items: itemsToDrag.length > 0 ? itemsToDrag : [{ id: elementId, origX: 0, origY: 0 }],
        startX: event.clientX,
        startY: event.clientY,
        initialTemplate: template,
        hasMoved: false,
      };
    },
    [canvasRef, dragState, selectedIds, selectedSet, template],
  );

  const onMouseDownResize = useCallback(
    (event: ReactMouseEvent, elementId: string, handle: ResizeHandle = "se") => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const el = template.elements.find((e) => e.id === elementId);
      if (!el) return;
      resizeState.current = {
        id: elementId,
        handle,
        startX: event.clientX,
        startY: event.clientY,
        origX: el.x,
        origY: el.y,
        origW: el.w,
        origH: el.h,
        initialTemplate: template,
        hasMoved: false,
      };
    },
    [resizeState, template],
  );

  return {
    selectedIds,
    setSelectedIds,
    selectedId,
    setSelectedId,
    selectedSet,
    selectedElements,
    selectedElement,
    deselectAll,
    selectAll,
    onMouseDownElement,
    onMouseDownResize,
  };
}
