import React from "react";
import { CANVAS_ACCENT } from "./templateEditorUtils";
import type { ResizeHandle } from "./useTemplateEditorInteractions";

const RESIZE_HANDLES: { handle: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
  { handle: "n", style: { top: -4, left: "calc(50% - 6px)" }, cursor: "cursor-ns-resize" },
  { handle: "s", style: { bottom: -4, left: "calc(50% - 6px)" }, cursor: "cursor-ns-resize" },
  { handle: "w", style: { left: -4, top: "calc(50% - 6px)" }, cursor: "cursor-ew-resize" },
  { handle: "e", style: { right: -4, top: "calc(50% - 6px)" }, cursor: "cursor-ew-resize" },
  { handle: "nw", style: { top: -5, left: -5 }, cursor: "cursor-nwse-resize" },
  { handle: "ne", style: { top: -5, right: -5 }, cursor: "cursor-nesw-resize" },
  { handle: "sw", style: { bottom: -5, left: -5 }, cursor: "cursor-nesw-resize" },
  { handle: "se", style: { bottom: -5, right: -5 }, cursor: "cursor-se-resize" },
];

export interface TemplateElementResizeHandlesProps {
  elementId: string;
  w: number;
  h: number;
  y: number;
  onMouseDownResize: (event: React.MouseEvent, elementId: string, handle?: ResizeHandle) => void;
}

export function TemplateElementResizeHandles({
  elementId,
  w,
  h,
  y,
  onMouseDownResize,
}: TemplateElementResizeHandlesProps): React.JSX.Element {
  return (
    <>
      {/* Selection chrome — never printed. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none print:hidden"
        style={{
          border: `1.5px solid ${CANVAS_ACCENT.selection}`,
          backgroundColor: CANVAS_ACCENT.selectionSoft,
        }}
      />
      {RESIZE_HANDLES.map(({ handle, style, cursor }) => (
        <div
          key={handle}
          tabIndex={-1}
          aria-hidden="true"
          onMouseDown={(e) => onMouseDownResize(e, elementId, handle)}
          style={{ ...style, borderColor: CANVAS_ACCENT.selection }}
          className={`absolute w-3 h-3 rounded-xs bg-white border-2 shadow-xs z-elevated hover:scale-125 hover:brightness-95 transition-transform touch-none print:hidden ${cursor}`}
        />
      ))}
      <div
        style={{
          left: 0,
          top: y < 24 ? h + 4 : -22,
          backgroundColor: CANVAS_ACCENT.selectionStrong,
        }}
        aria-live="off"
        aria-hidden="true"
        className="absolute text-white font-mono text-3xs font-medium px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap pointer-events-none z-sticky print:hidden"
      >
        {`${Math.round(w)} × ${Math.round(h)}`}
      </div>
    </>
  );
}
