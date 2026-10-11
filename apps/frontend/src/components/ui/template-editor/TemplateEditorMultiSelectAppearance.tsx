import React, { useId } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ElementStyle } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { StyleInput } from "./TemplateEditorStyleControls";
import { TemplateEditorSection } from "./TemplateEditorSection";

export interface TemplateEditorMultiSelectAppearanceProps {
  isOpen: boolean;
  onToggle: () => void;
  initialBgColor: string;
  initialBorderColor: string;
  initialBorderRadius: number;
  initialBorderWidth: number;
  onPatchSelectedStyles: (stylePatch: Partial<ElementStyle>) => void;
  t: TranslationFunction;
}

export function TemplateEditorMultiSelectAppearance({
  isOpen,
  onToggle,
  initialBgColor,
  initialBorderColor,
  initialBorderRadius,
  initialBorderWidth,
  onPatchSelectedStyles,
  t,
}: TemplateEditorMultiSelectAppearanceProps): React.JSX.Element {
  const bgColorId = useId();
  const borderColorId = useId();

  return (
    <TemplateEditorSection
      titleKey="templateEditor.appearance"
      icon={Palette}
      isOpen={isOpen}
      onToggle={onToggle}
      t={t}
      panelClassName="space-y-3"
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
              type="color"
              value={initialBgColor}
              onChange={(e) => onPatchSelectedStyles({ backgroundColor: e.target.value })}
              className="w-11 h-11 p-0.5 border border-border rounded-md bg-background cursor-pointer touch-manipulation min-h-11 min-w-11"
              title={t("templateEditor.backgroundColor")}
              aria-label={t("templateEditor.backgroundColor")}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => onPatchSelectedStyles({ backgroundColor: undefined })}
              className="min-h-11 text-3xs px-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
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
            type="color"
            value={initialBorderColor}
            onChange={(e) => onPatchSelectedStyles({ borderColor: e.target.value })}
            className="w-full min-h-11 h-11 p-1 border border-border rounded-lg bg-background cursor-pointer"
            title={t("templateEditor.borderColor")}
            aria-label={t("templateEditor.borderColor")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StyleInput
          label={t("templateEditor.borderWidth")}
          numeric
          min={0}
          max={12}
          value={initialBorderWidth}
          onChange={(val) => {
            const num = Number(val);
            if (!Number.isNaN(num))
              onPatchSelectedStyles({ borderWidth: Math.max(0, Math.min(12, num)) });
          }}
        />
        <StyleInput
          label={t("templateEditor.borderRadius")}
          numeric
          min={0}
          max={32}
          value={initialBorderRadius}
          onChange={(val) => {
            const num = Number(val);
            if (!Number.isNaN(num))
              onPatchSelectedStyles({ borderRadius: Math.max(0, Math.min(32, num)) });
          }}
        />
      </div>
    </TemplateEditorSection>
  );
}
