import React, { useId } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ElementStyle } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { StyleInput } from "./TemplateEditorStyleControls";
import { normalizeHexColor } from "./templateEditorUtils";
import { TemplateEditorSection } from "./TemplateEditorSection";
import { PRINT_COLORS } from "@/lib/ui/printTemplateStyles";

export interface TemplateEditorAppearanceSectionProps {
  elementId: string;
  elStyle: ElementStyle;
  isOpen: boolean;
  onToggle: () => void;
  onPatchStyle: (elementId: string, stylePatch: Partial<ElementStyle>) => void;
  t: TranslationFunction;
}

export function TemplateEditorAppearanceSection({
  elementId,
  elStyle,
  isOpen,
  onToggle,
  onPatchStyle,
  t,
}: TemplateEditorAppearanceSectionProps): React.JSX.Element {
  const bgColorId = useId();
  const borderColorId = useId();

  return (
    <TemplateEditorSection
      titleKey="templateEditor.appearance"
      icon={Palette}
      isOpen={isOpen}
      onToggle={onToggle}
      t={t}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <label
            htmlFor={bgColorId}
            className="text-xs font-bold uppercase text-muted-foreground tracking-wide"
          >
            {t("templateEditor.backgroundColor")}
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id={bgColorId}
              name={bgColorId}
              aria-label={t("templateEditor.backgroundColor")}
              type="color"
              value={normalizeHexColor(elStyle.backgroundColor, PRINT_COLORS.white)}
              onChange={(e) => onPatchStyle(elementId, { backgroundColor: e.target.value })}
              className="w-11 h-11 p-0.5 border border-border rounded-md bg-background cursor-pointer touch-manipulation min-h-11 min-w-11"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => onPatchStyle(elementId, { backgroundColor: undefined })}
              className="min-h-11 text-3xs px-2"
              title={t("templateEditor.transparent")}
              aria-label={t("templateEditor.transparent")}
            >
              {t("templateEditor.transparent")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <label
            htmlFor={borderColorId}
            className="text-xs font-bold uppercase text-muted-foreground tracking-wide"
          >
            {t("templateEditor.borderColor")}
          </label>
          <input
            id={borderColorId}
            name={borderColorId}
            aria-label={t("templateEditor.borderColor")}
            type="color"
            value={normalizeHexColor(elStyle.borderColor, PRINT_COLORS.borderSlate)}
            onChange={(e) => onPatchStyle(elementId, { borderColor: e.target.value })}
            className="w-full min-h-11 h-11 p-1 border border-border rounded-lg bg-background cursor-pointer"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StyleInput
          label={t("templateEditor.borderWidth")}
          numeric
          min={0}
          max={12}
          value={elStyle.borderWidth ?? 0}
          onChange={(val) => {
            const num = Number(val);
            if (!Number.isNaN(num)) {
              onPatchStyle(elementId, { borderWidth: Math.max(0, Math.min(12, num)) });
            }
          }}
        />
        <StyleInput
          label={t("templateEditor.borderRadius")}
          numeric
          min={0}
          max={32}
          value={elStyle.borderRadius ?? 0}
          onChange={(val) => {
            const num = Number(val);
            if (!Number.isNaN(num)) {
              onPatchStyle(elementId, { borderRadius: Math.max(0, Math.min(32, num)) });
            }
          }}
        />
      </div>
    </TemplateEditorSection>
  );
}
