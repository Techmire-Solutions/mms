import React from "react";
import { LayoutTemplate } from "lucide-react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorCanvasEmptyStateProps {
  isPreviewMode?: boolean;
  t: TranslationFunction;
}

export function TemplateEditorCanvasEmptyState({
  isPreviewMode = false,
  t,
}: TemplateEditorCanvasEmptyStateProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none print:hidden"
    >
      <div className="flex flex-col items-center gap-3 opacity-40">
        <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
          <LayoutTemplate className="w-7 h-7 text-muted-foreground/60" />
        </div>
        <div className="text-center" dir="auto">
          <p className="text-xs font-semibold text-muted-foreground m-0">
            {t(
              isPreviewMode ? "templateEditor.emptyPreviewHint" : "templateEditor.emptyCanvasHint",
            )}
          </p>
          {!isPreviewMode && (
            <p className="text-2xs text-muted-foreground mt-0.5 m-0">
              {t("templateEditor.emptyCanvasHintDetail")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
