import React from "react";
import type { PageSizeInfo } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorCanvasStatusPillProps {
  size: PageSizeInfo;
  canvasScale: number;
  isPreviewMode?: boolean;
  t: TranslationFunction;
}

export function TemplateEditorCanvasStatusPill({
  size,
  canvasScale,
  isPreviewMode = false,
  t,
}: TemplateEditorCanvasStatusPillProps): React.JSX.Element {
  return (
    <div
      role="status"
      className="mb-3 px-3 py-1 rounded-full bg-background/90 border border-border/70 text-3xs text-muted-foreground font-mono shadow-sm backdrop-blur-md flex items-center gap-2 ring-1 ring-black/[0.04] print:hidden"
    >
      <span className="font-semibold text-foreground">{size.label}</span>
      <span className="text-border">·</span>
      <span>
        {size.width} × {size.height} px
      </span>
      <span className="text-border">·</span>
      <span className="font-medium text-foreground/90">{Math.round(canvasScale * 100)}%</span>
      {isPreviewMode && (
        <>
          <span className="text-border">·</span>
          <span className="text-success font-bold uppercase tracking-wider text-2xs flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {t("templateEditor.previewMode")}
          </span>
        </>
      )}
    </div>
  );
}
