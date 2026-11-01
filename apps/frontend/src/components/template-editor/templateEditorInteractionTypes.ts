import type { RefObject } from "react";
import type { DocumentTemplate, PageSizeInfo, TemplateElement } from "@mms/shared";

export interface DragItem {
  id: string;
  origX: number;
  origY: number;
}

export interface DragStateInfo<TPayload = Record<string, unknown>> {
  items: DragItem[];
  startX: number;
  startY: number;
  initialTemplate: DocumentTemplate<TPayload>;
  hasMoved?: boolean;
}

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface ResizeStateInfo<TPayload = Record<string, unknown>> {
  id: string;
  handle?: ResizeHandle;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  initialTemplate: DocumentTemplate<TPayload>;
  hasMoved?: boolean;
}

export interface DragResizeRefs<TPayload = Record<string, unknown>> {
  dragState: RefObject<DragStateInfo<TPayload> | null>;
  resizeState: RefObject<ResizeStateInfo<TPayload> | null>;
  canvasViewportRef?: RefObject<HTMLElement | null>;
}

export interface UseTemplateEditorInteractionsOptions<
  TPayload = Record<string, unknown>,
> extends DragResizeRefs<TPayload> {
  canvasScale: number;
  size: PageSizeInfo;
  templateElements: TemplateElement<keyof TPayload & string>[];
  updateElements: (
    updateFn: (
      templateElements: TemplateElement<keyof TPayload & string>[],
    ) => TemplateElement<keyof TPayload & string>[],
  ) => void;
  /** Records the pre-drag snapshot as one undo step. */
  pushHistory: (snapshot: DocumentTemplate<TPayload>) => void;
  /** Restricts the Space-to-pan shortcut to this editor instance. */
  editorId?: string;
}
