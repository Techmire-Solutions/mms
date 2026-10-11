/**
 * @file templateEditorTypographyUtils.ts
 * @description Constants and style aggregation utilities for template editor typography controls.
 */

import type { ElementStyle, TemplateElement } from "@mms/shared";
import { PRINT_NEUTRAL } from "@/lib/printBrandingTokens";
import { normalizeHexColor } from "./templateEditorUtils";

export const SWATCHES = [
  { labelKey: "templateEditor.swatchText", color: PRINT_NEUTRAL.text },
  { labelKey: "templateEditor.swatchMuted", color: PRINT_NEUTRAL.muted },
  { labelKey: "templateEditor.swatchSuccess", color: "#10b981" },
  { labelKey: "templateEditor.swatchWarning", color: "#f59e0b" },
  { labelKey: "templateEditor.swatchDestructive", color: "#ef4444" },
] as const;

export const FONT_OPTIONS = [
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "'Amiri', serif", label: "Amiri" },
  { value: "'Cairo', sans-serif", label: "Cairo" },
  { value: "'Noto Nastaliq Urdu', serif", label: "Noto Nastaliq Urdu" },
  { value: "monospace", label: "Monospace" },
];

export interface TypographyResolvedStates {
  allBold: boolean;
  allItalic: boolean;
  allUnderline: boolean;
  allStrikethrough: boolean;
  allRtl: boolean;
  isMixedRtl: boolean;
  startAlign: "left" | "right";
  endAlign: "left" | "right";
  allAlignStart: boolean;
  allAlignCenter: boolean;
  allAlignEnd: boolean;
  allAlignJustify: boolean;
  effectiveColor: string;
  allSameColor: boolean;
}

export function resolveTypographyStates(
  elStyle: Partial<ElementStyle>,
  selectedElements?: TemplateElement[],
  isRtl = false,
): TypographyResolvedStates {
  const isMulti = Boolean(selectedElements && selectedElements.length > 1);
  const textElements = isMulti
    ? selectedElements!.filter((el) => el.type === "static" || el.type === "field")
    : [];
  const targetElements = textElements.length > 0 ? textElements : (selectedElements ?? []);

  const allBold = isMulti
    ? targetElements.length > 0 && targetElements.every((el) => el.style?.fontWeight === "bold")
    : elStyle.fontWeight === "bold";

  const allItalic = isMulti
    ? targetElements.length > 0 && targetElements.every((el) => el.style?.fontStyle === "italic")
    : elStyle.fontStyle === "italic";

  const allUnderline = isMulti
    ? targetElements.length > 0 &&
      targetElements.every((el) => el.style?.textDecoration === "underline")
    : elStyle.textDecoration === "underline";

  const allStrikethrough = isMulti
    ? targetElements.length > 0 &&
      targetElements.every((el) => el.style?.textDecoration === "line-through")
    : elStyle.textDecoration === "line-through";

  const hasRtl = isMulti && targetElements.some((el) => el.style?.direction === "rtl");
  const allRtl = isMulti
    ? targetElements.length > 0 && targetElements.every((el) => el.style?.direction === "rtl")
    : elStyle.direction === "rtl";
  const isMixedRtl = isMulti && hasRtl && !allRtl;

  const startAlign = isRtl ? "right" : "left";
  const endAlign = isRtl ? "left" : "right";

  const allAlignStart = isMulti
    ? targetElements.length > 0 &&
      targetElements.every((el) => (el.style?.textAlign || startAlign) === startAlign)
    : elStyle.textAlign === startAlign || !elStyle.textAlign;

  const allAlignCenter = isMulti
    ? targetElements.length > 0 && targetElements.every((el) => el.style?.textAlign === "center")
    : elStyle.textAlign === "center";

  const allAlignEnd = isMulti
    ? targetElements.length > 0 && targetElements.every((el) => el.style?.textAlign === endAlign)
    : elStyle.textAlign === endAlign;

  const allAlignJustify = isMulti
    ? targetElements.length > 0 && targetElements.every((el) => el.style?.textAlign === "justify")
    : elStyle.textAlign === "justify";

  const effectiveColor = normalizeHexColor(elStyle.color, PRINT_NEUTRAL.text).toLowerCase();
  const allSameColor = isMulti
    ? targetElements.length > 0 &&
      targetElements.every(
        (el) =>
          normalizeHexColor(el.style?.color, PRINT_NEUTRAL.text).toLowerCase() === effectiveColor,
      )
    : true;

  return {
    allBold,
    allItalic,
    allUnderline,
    allStrikethrough,
    allRtl,
    isMixedRtl,
    startAlign,
    endAlign,
    allAlignStart,
    allAlignCenter,
    allAlignEnd,
    allAlignJustify,
    effectiveColor,
    allSameColor,
  };
}
