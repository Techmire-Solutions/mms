/**
 * @file useTemplateEditorAlignActions.ts
 * @description Sub-hook providing alignment, distribution, page centering, edge snapping, and dimension equalization.
 */

import { useCallback } from "react";
import type { PageSizeInfo, TemplateElement } from "@mms/shared";
import {
  alignElements,
  centerElementOnPage,
  distributeElements,
  snap,
  type AlignmentType,
} from "./templateEditorUtils";

export interface UseTemplateEditorAlignActionsOptions<TPayload = Record<string, unknown>> {
  selectedIds: string[];
  commitUpdate: (
    updateFn: (
      elements: TemplateElement<keyof TPayload & string>[],
    ) => TemplateElement<keyof TPayload & string>[],
  ) => void;
  size: PageSizeInfo;
}

export function useTemplateEditorAlignActions<TPayload = Record<string, unknown>>({
  selectedIds,
  commitUpdate,
  size,
}: UseTemplateEditorAlignActionsOptions<TPayload>) {
  const alignSelected = useCallback(
    (alignType: AlignmentType) => {
      if (selectedIds.length < 2) return;
      commitUpdate((els) => alignElements(els, selectedIds, alignType));
    },
    [commitUpdate, selectedIds],
  );

  const distributeSelected = useCallback(
    (axis: "horizontal" | "vertical") => {
      if (selectedIds.length < 2) return;
      commitUpdate((els) => distributeElements(els, selectedIds, axis));
    },
    [commitUpdate, selectedIds],
  );

  const centerSelected = useCallback(
    (axis: "both" | "h" | "v" = "both") => {
      if (selectedIds.length === 0) return;
      const idSet = new Set(selectedIds);
      commitUpdate((els) =>
        els.map((el) =>
          idSet.has(el.id) ? centerElementOnPage(el, size.width, size.height, axis) : el,
        ),
      );
    },
    [commitUpdate, selectedIds, size.height, size.width],
  );

  /** Snaps all selected elements to one of the four page edges conforming to the grid. */
  const snapSelected = useCallback(
    (edge: "top" | "bottom" | "left" | "right") => {
      if (selectedIds.length === 0) return;
      const idSet = new Set(selectedIds);
      commitUpdate((els) =>
        els.map((el) => {
          if (!idSet.has(el.id)) return el;
          switch (edge) {
            case "top":
              return { ...el, y: 0 };
            case "bottom":
              return { ...el, y: snap(Math.max(0, size.height - el.h)) };
            case "left":
              return { ...el, x: 0 };
            case "right":
              return { ...el, x: snap(Math.max(0, size.width - el.w)) };
          }
        }),
      );
    },
    [commitUpdate, selectedIds, size.height, size.width],
  );

  /** Equalizes width, height, or both across selected elements to match the largest in the selection. */
  const equalizeSelectedDimensions = useCallback(
    (dimension: "width" | "height" | "both") => {
      if (selectedIds.length < 2) return;
      const idSet = new Set(selectedIds);

      commitUpdate((els) => {
        const targets = els.filter((el) => idSet.has(el.id));
        if (targets.length < 2) return els;
        const maxWidth = Math.max(...targets.map((el) => el.w));
        const maxHeight = Math.max(...targets.map((el) => el.h));

        return els.map((el) => {
          if (!idSet.has(el.id)) return el;
          return {
            ...el,
            w: dimension === "height" ? el.w : Math.max(4, Math.min(maxWidth, size.width - el.x)),
            h: dimension === "width" ? el.h : Math.max(4, Math.min(maxHeight, size.height - el.y)),
          };
        });
      });
    },
    [commitUpdate, selectedIds, size.height, size.width],
  );

  return {
    alignSelected,
    distributeSelected,
    centerSelected,
    snapSelected,
    equalizeSelectedDimensions,
  };
}
