import React from "react";
import { CANVAS_ACCENT, type SmartGuideLine } from "./templateEditorUtils";

export interface TemplateEditorCanvasGuidesProps {
  activeGuides?: SmartGuideLine[];
}

export function TemplateEditorCanvasGuides({
  activeGuides = [],
}: TemplateEditorCanvasGuidesProps): React.JSX.Element {
  return (
    <>
      {activeGuides.map((guide) => (
        <div
          key={`guide-${guide.orientation}-${guide.position}`}
          aria-hidden="true"
          className="print:hidden"
          style={
            guide.orientation === "vertical"
              ? {
                  position: "absolute",
                  left: guide.position,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  borderLeft: `1px dashed ${CANVAS_ACCENT.selection}`,
                  pointerEvents: "none",
                  zIndex: 25,
                }
              : {
                  position: "absolute",
                  top: guide.position,
                  left: 0,
                  right: 0,
                  height: 1,
                  borderTop: `1px dashed ${CANVAS_ACCENT.selection}`,
                  pointerEvents: "none",
                  zIndex: 25,
                }
          }
        />
      ))}
    </>
  );
}
