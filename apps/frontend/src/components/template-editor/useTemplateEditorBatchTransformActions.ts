import { useCallback } from "react";
import type { ElementStyle, PageSizeInfo, TemplateElement } from "@mms/shared";

export interface UseTemplateEditorBatchTransformActionsOptions<TPayload = Record<string, unknown>> {
  selectedIds: string[];
  size: PageSizeInfo;
  commitUpdateCoalesced: (
    coalesceKey: string,
    updateFn: (
      elements: TemplateElement<keyof TPayload & string>[],
    ) => TemplateElement<keyof TPayload & string>[],
  ) => void;
}

export function useTemplateEditorBatchTransformActions<TPayload = Record<string, unknown>>({
  selectedIds,
  size,
  commitUpdateCoalesced,
}: UseTemplateEditorBatchTransformActionsOptions<TPayload>) {
  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.length === 0) return;
      const idSet = new Set(selectedIds);
      commitUpdateCoalesced("nudge", (els) =>
        els.map((el) =>
          idSet.has(el.id)
            ? {
                ...el,
                x: Math.min(Math.max(0, size.width - el.w), Math.max(0, el.x + dx)),
                y: Math.min(Math.max(0, size.height - el.h), Math.max(0, el.y + dy)),
              }
            : el,
        ),
      );
    },
    [commitUpdateCoalesced, selectedIds, size.height, size.width],
  );

  const resizeSelected = useCallback(
    (dw: number, dh: number) => {
      if (selectedIds.length === 0) return;
      const idSet = new Set(selectedIds);
      commitUpdateCoalesced("resize", (els) =>
        els.map((el) =>
          idSet.has(el.id)
            ? {
                ...el,
                w: Math.min(Math.max(20, size.width - el.x), Math.max(20, el.w + dw)),
                h: Math.min(Math.max(4, size.height - el.y), Math.max(4, el.h + dh)),
              }
            : el,
        ),
      );
    },
    [commitUpdateCoalesced, selectedIds, size.height, size.width],
  );

  const patchSelectedStyles = useCallback(
    (stylePatch: Partial<ElementStyle>) => {
      if (selectedIds.length === 0) return;
      const idSet = new Set(selectedIds);
      const keys = Object.keys(stylePatch).join(",");
      commitUpdateCoalesced(`styleSelected:${keys}`, (els) =>
        els.map((el) =>
          idSet.has(el.id)
            ? {
                ...el,
                style: { ...el.style, ...stylePatch },
              }
            : el,
        ),
      );
    },
    [commitUpdateCoalesced, selectedIds],
  );

  return {
    nudgeSelected,
    resizeSelected,
    patchSelectedStyles,
  };
}
