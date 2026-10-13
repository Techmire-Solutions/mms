import React from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { AlignmentType } from "./templateEditorUtils";

export interface TemplateEditorAlignmentGridProps {
  onAlignSelected: (alignType: AlignmentType) => void;
  t: TranslationFunction;
}

/**
 * Alignment of a multi-element selection.
 *
 * Deliberately physical (the left/right edge of the selection) rather than logical
 * start/end: element coordinates are absolute left-origin values on an LTR canvas, so
 * "align left edge" means the same edge in every locale. The buttons are icon-only with
 * translated titles because the long labels wrapped inside the 240px inspector.
 */
export function TemplateEditorAlignmentGrid({
  onAlignSelected,
  t,
}: TemplateEditorAlignmentGridProps): React.JSX.Element {
  const buttons: {
    key: AlignmentType;
    label: string;
    Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  }[] = [
    { key: "left", label: t("templateEditor.alignLeft"), Icon: AlignStartHorizontal },
    { key: "centerH", label: t("templateEditor.alignCenterH"), Icon: AlignCenterHorizontal },
    { key: "right", label: t("templateEditor.alignRight"), Icon: AlignEndHorizontal },
    { key: "top", label: t("templateEditor.alignTop"), Icon: AlignStartVertical },
    { key: "centerV", label: t("templateEditor.alignCenterV"), Icon: AlignCenterVertical },
    { key: "bottom", label: t("templateEditor.alignBottom"), Icon: AlignEndVertical },
  ];

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {buttons.map(({ key, label, Icon }) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          onClick={() => onAlignSelected(key)}
          title={label}
          aria-label={label}
          className="min-h-11 min-w-11 p-0 flex items-center justify-center rounded-lg border border-border hover:bg-muted"
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
