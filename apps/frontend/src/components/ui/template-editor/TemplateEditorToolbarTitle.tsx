import React from "react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorToolbarTitleProps {
  title?: string;
  titleId?: string;
  isDirty?: boolean;
  saved?: boolean;
  t: TranslationFunction;
}

export function TemplateEditorToolbarTitle({
  title,
  titleId,
  isDirty = false,
  saved = false,
  t,
}: TemplateEditorToolbarTitleProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <h2
        id={titleId}
        className="font-bold text-sm text-foreground m-0 whitespace-nowrap max-w-[38ch] truncate"
      >
        {title || t("templateEditor.title")}
      </h2>
      {isDirty && !saved && (
        <span
          role="status"
          aria-live="polite"
          className="px-1.5 py-0.5 rounded-full text-3xs font-bold border border-warning/30 bg-warning/10 text-warning whitespace-nowrap animate-pulse"
          title={t("templateEditor.dirtyNotice")}
        >
          {t("templateEditor.dirtyNotice")}
        </span>
      )}
    </div>
  );
}
