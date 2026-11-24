import React from "react";
import { CANVAS_ACCENT } from "./templateEditorUtils";
import type { MarqueeBox } from "./useTemplateMarquee";

export interface TemplateEditorMarqueeOverlayProps {
  marquee: MarqueeBox | null;
}

export function TemplateEditorMarqueeOverlay({
  marquee,
}: TemplateEditorMarqueeOverlayProps): React.JSX.Element | null {
  if (!marquee) return null;

  return (
    <div
      aria-hidden="true"
      className="print:hidden"
      style={{
        position: "absolute",
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
        backgroundColor: CANVAS_ACCENT.marqueeSoft,
        border: `1px dashed ${CANVAS_ACCENT.selection}`,
        borderRadius: "2px",
        pointerEvents: "none",
      }}
    />
  );
}
