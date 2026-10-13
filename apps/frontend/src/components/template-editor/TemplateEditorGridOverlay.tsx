import React from "react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { CANVAS_ACCENT } from "./templateEditorUtils";

export interface TemplateEditorGridOverlayProps {
  showGuides: boolean;
  isPreviewMode: boolean;
  t: TranslationFunction;
}

export function TemplateEditorGridOverlay({
  showGuides,
  isPreviewMode,
  t,
}: TemplateEditorGridOverlayProps): React.JSX.Element | null {
  if (!showGuides || isPreviewMode) return null;

  return (
    <div className="print:hidden" aria-hidden="true">
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(${CANVAS_ACCENT.grid} 1px, transparent 1px)`,
          backgroundSize: "16px 16px",
        }}
      />
      <div
        className="absolute inset-6 pointer-events-none border border-dashed border-info/35 rounded-xs"
        title={t("templateEditor.safeMargins")}
      />
    </div>
  );
}
