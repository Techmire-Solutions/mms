import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { PageSizeInfo, TemplateElement } from "@mms/shared";
import { newId, snap } from "./templateEditorUtils";

export interface UseTemplateEditorDuplicateActionsOptions<TPayload> {
  elementsRef: MutableRefObject<TemplateElement<keyof TPayload & string>[]>;
  commitUpdate: (
    updateFn: (
      elements: TemplateElement<keyof TPayload & string>[],
    ) => TemplateElement<keyof TPayload & string>[],
  ) => void;
  size: PageSizeInfo;
  onElementAdded?: (elementId: string) => void;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
}

export function useTemplateEditorDuplicateActions<TPayload>({
  elementsRef,
  commitUpdate,
  size,
  onElementAdded,
  selectedIds,
  setSelectedIds,
}: UseTemplateEditorDuplicateActionsOptions<TPayload>) {
  const offsetFrom = useCallback(
    (el: TemplateElement<keyof TPayload & string>, delta: number) => {
      const nextX = el.x + delta;
      const nextY = el.y + delta;
      return {
        x: nextX + el.w > size.width ? snap(Math.max(0, size.width - el.w - delta)) : snap(nextX),
        y: nextY + el.h > size.height ? snap(Math.max(0, size.height - el.h - delta)) : snap(nextY),
      };
    },
    [size.height, size.width],
  );

  const duplicateElement = useCallback(
    (elementId: string) => {
      const el = elementsRef.current.find((e) => e.id === elementId);
      if (!el) return;
      const { x, y } = offsetFrom(el, 12);
      const duplicated: TemplateElement<keyof TPayload & string> = {
        ...el,
        id: newId(),
        x,
        y,
        style: { ...el.style },
        columns: el.columns ? el.columns.map((col) => ({ ...col, id: newId() })) : undefined,
        tableConfig: el.tableConfig ? { ...el.tableConfig } : undefined,
      };
      commitUpdate((els) => [...els, duplicated]);
      setSelectedIds([duplicated.id]);
      onElementAdded?.(duplicated.id);
    },
    [commitUpdate, elementsRef, offsetFrom, onElementAdded, setSelectedIds],
  );

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    const targets = elementsRef.current.filter((el) => idSet.has(el.id));
    if (targets.length === 0) return;
    const newElements = targets.map((el) => {
      const { x, y } = offsetFrom(el, 12);
      return {
        ...el,
        id: newId(),
        x,
        y,
        style: { ...el.style },
        columns: el.columns ? el.columns.map((col) => ({ ...col, id: newId() })) : undefined,
        tableConfig: el.tableConfig ? { ...el.tableConfig } : undefined,
      };
    });
    commitUpdate((els) => [...els, ...newElements]);
    setSelectedIds(newElements.map((el) => el.id));
    if (newElements[0]) onElementAdded?.(newElements[0].id);
  }, [commitUpdate, elementsRef, offsetFrom, onElementAdded, selectedIds, setSelectedIds]);

  return {
    offsetFrom,
    duplicateElement,
    duplicateSelected,
  };
}
