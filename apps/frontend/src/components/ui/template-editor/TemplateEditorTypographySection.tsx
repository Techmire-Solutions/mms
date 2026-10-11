/**
 * @file TemplateEditorTypographySection.tsx
 * @description Inspector section for font family, size, color swatches, weight, alignment, and RTL.
 */

import React, { useId } from "react";
import { Type } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/ui/FormSelect";
import type { ElementStyle, TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { TemplateEditorSection } from "./TemplateEditorSection";
import { TemplateEditorTypographyStyleButtons } from "./TemplateEditorTypographyStyleButtons";
import { TemplateEditorTypographySwatches } from "./TemplateEditorTypographySwatches";
import { TemplateEditorFontSizeColorControls } from "./TemplateEditorFontSizeColorControls";
import { FONT_OPTIONS, SWATCHES, resolveTypographyStates } from "./templateEditorTypographyUtils";
import { PRINT_EMERALD, PRINT_EMERALD_DEEP } from "@/lib/printTemplateStyles";

export { FONT_OPTIONS, SWATCHES };

export interface TemplateEditorTypographySectionProps {
  elementId?: string;
  elStyle: Partial<ElementStyle>;
  selectedElements?: TemplateElement[];
  isOpen: boolean;
  onToggle: () => void;
  onPatchStyle: (stylePatch: Partial<ElementStyle>) => void;
  primaryColor?: string;
  secondaryColor?: string;
  /** Whether the *application* is rendered right-to-left (ar/ur/fa). */
  isRtl?: boolean;
  t: TranslationFunction;
}

export function TemplateEditorTypographySection({
  elStyle,
  selectedElements,
  isOpen,
  onToggle,
  onPatchStyle,
  primaryColor,
  secondaryColor,
  isRtl = false,
  t,
}: TemplateEditorTypographySectionProps): React.JSX.Element {
  const fontFamilyId = useId();
  const fontSizeId = useId();
  const fontColorId = useId();
  const rtlToggleId = useId();

  const handlePatch = onPatchStyle;

  const states = resolveTypographyStates(elStyle, selectedElements, isRtl);
  const { isMixedRtl, allRtl, effectiveColor, allSameColor } = states;
  const currentFontSize = Number(elStyle.fontSize ?? 10) || 10;

  const swatches = [
    { label: t("templateEditor.swatchBrandPrimary"), color: primaryColor || PRINT_EMERALD },
    {
      label: t("templateEditor.swatchBrandSecondary"),
      color: secondaryColor || PRINT_EMERALD_DEEP,
    },
    ...SWATCHES.map((s) => ({ label: t(s.labelKey), color: s.color })),
  ];

  return (
    <TemplateEditorSection
      titleKey="templateEditor.typography"
      icon={Type}
      isOpen={isOpen}
      onToggle={onToggle}
      t={t}
      panelClassName="space-y-3"
    >
      <div className="space-y-1">
        <label
          htmlFor={fontFamilyId}
          className="text-xs font-bold uppercase text-muted-foreground tracking-wide"
        >
          {t("templateEditor.fontFamily")}
        </label>
        <FormSelect
          id={fontFamilyId}
          aria-label={t("templateEditor.fontFamily")}
          value={elStyle.fontFamily || "Inter, sans-serif"}
          onChange={(val) => handlePatch({ fontFamily: val })}
          options={FONT_OPTIONS}
          className="h-11 text-xs py-0 w-full"
        />
      </div>

      <TemplateEditorFontSizeColorControls
        fontSizeId={fontSizeId}
        fontColorId={fontColorId}
        currentFontSize={currentFontSize}
        color={elStyle.color}
        onPatchStyle={handlePatch}
        t={t}
      />

      <TemplateEditorTypographySwatches
        swatches={swatches}
        allSameColor={allSameColor}
        effectiveColor={effectiveColor}
        onSelectColor={(color) => handlePatch({ color })}
        paletteLabel={t("templateEditor.themePalette")}
      />

      <TemplateEditorTypographyStyleButtons states={states} onPatchStyle={handlePatch} t={t} />

      <div className="pt-1">
        <div className="min-h-11 flex items-center gap-2.5 select-none">
          <Checkbox
            id={rtlToggleId}
            checked={isMixedRtl ? "indeterminate" : allRtl}
            onCheckedChange={(checked) =>
              handlePatch({ direction: checked === true ? "rtl" : "ltr" })
            }
            className="cursor-pointer"
          />
          <label
            htmlFor={rtlToggleId}
            className="cursor-pointer text-xs font-medium text-foreground"
          >
            {t("templateEditor.rtl")}
          </label>
        </div>
      </div>
    </TemplateEditorSection>
  );
}
