/**
 * @file TemplateEditorPageControls.tsx
 * @description Page size selector and portrait/landscape orientation toggle.
 */

import React from "react";
import { RectangleHorizontal, RectangleVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/app/FormSelect";
import { PAGE_SIZES, type TemplateOrientation } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorPageControlsProps {
  pageSize: string;
  orientation: TemplateOrientation;
  onPageSizeChange: (pageSizeKey: string) => void;
  onOrientationChange: (orientation: TemplateOrientation) => void;
  t: TranslationFunction;
}

export function TemplateEditorPageControls({
  pageSize,
  orientation,
  onPageSizeChange,
  onOrientationChange,
  t,
}: TemplateEditorPageControlsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 ms-2 bg-muted/40 p-0.5 rounded-lg border border-border/70">
      <FormSelect
        aria-label={t("templateEditor.pageSize")}
        value={pageSize}
        onChange={(val) => onPageSizeChange(val)}
        options={Object.entries(PAGE_SIZES).map(([key, info]) => ({
          value: key,
          label: info.label,
        }))}
        className="h-8 text-xs font-medium py-0 min-w-32 border-0 bg-transparent shadow-none"
      />

      <Button
        type="button"
        onClick={() => onOrientationChange(orientation === "landscape" ? "portrait" : "landscape")}
        variant="ghost"
        size="sm"
        className="min-h-11 px-2 text-xs font-medium rounded hover:bg-background/80 transition-all flex items-center gap-1"
        title={
          orientation === "landscape" ? t("templateEditor.portrait") : t("templateEditor.landscape")
        }
      >
        {orientation === "landscape" ? (
          <>
            <RectangleHorizontal className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">{t("templateEditor.landscape")}</span>
          </>
        ) : (
          <>
            <RectangleVertical className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">{t("templateEditor.portrait")}</span>
          </>
        )}
      </Button>
    </div>
  );
}
