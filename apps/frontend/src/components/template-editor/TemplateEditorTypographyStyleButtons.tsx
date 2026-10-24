/**
 * @file TemplateEditorTypographyStyleButtons.tsx
 * @description Format toolbar buttons for font styles and alignments.
 */

import React from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Strikethrough,
  Underline,
} from "lucide-react";
import type { ElementStyle } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { StyleBtn } from "./TemplateEditorStyleControls";
import type { TypographyResolvedStates } from "./templateEditorTypographyUtils";

export interface TemplateEditorTypographyStyleButtonsProps {
  states: TypographyResolvedStates;
  onPatchStyle: (stylePatch: Partial<ElementStyle>) => void;
  t: TranslationFunction;
}

export function TemplateEditorTypographyStyleButtons({
  states,
  onPatchStyle,
  t,
}: TemplateEditorTypographyStyleButtonsProps): React.JSX.Element {
  const {
    allBold,
    allItalic,
    allUnderline,
    allStrikethrough,
    startAlign,
    endAlign,
    allAlignStart,
    allAlignCenter,
    allAlignEnd,
    allAlignJustify,
  } = states;

  return (
    <div
      role="group"
      aria-label={t("templateEditor.textStyle")}
      className="flex flex-wrap items-center gap-1.5"
    >
      <StyleBtn
        active={allBold}
        onClick={() => onPatchStyle({ fontWeight: allBold ? "normal" : "bold" })}
        title={t("templateEditor.bold")}
      >
        <Bold className="w-4 h-4" aria-hidden="true" />
      </StyleBtn>
      <StyleBtn
        active={allItalic}
        onClick={() => onPatchStyle({ fontStyle: allItalic ? "normal" : "italic" })}
        title={t("templateEditor.italic")}
      >
        <Italic className="w-4 h-4" aria-hidden="true" />
      </StyleBtn>
      <StyleBtn
        active={allUnderline}
        onClick={() => onPatchStyle({ textDecoration: allUnderline ? "none" : "underline" })}
        title={t("templateEditor.underline")}
      >
        <Underline className="w-4 h-4" aria-hidden="true" />
      </StyleBtn>
      <StyleBtn
        active={allStrikethrough}
        onClick={() => onPatchStyle({ textDecoration: allStrikethrough ? "none" : "line-through" })}
        title={t("templateEditor.strikethrough")}
      >
        <Strikethrough className="w-4 h-4" aria-hidden="true" />
      </StyleBtn>

      {/*
       * Alignment is presented as start/end, not left/right: in an Urdu or Arabic
       * workspace "align left" is the *end* of the line, and the icons mirror with
       * `rtl:-scale-x-100` so the glyph points at the edge it actually aligns to.
       */}
      <StyleBtn
        active={allAlignStart}
        onClick={() => onPatchStyle({ textAlign: startAlign })}
        title={t("templateEditor.alignStart")}
      >
        <AlignLeft className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />
      </StyleBtn>
      <StyleBtn
        active={allAlignCenter}
        onClick={() => onPatchStyle({ textAlign: "center" })}
        title={t("templateEditor.alignCenter")}
      >
        <AlignCenter className="w-4 h-4" aria-hidden="true" />
      </StyleBtn>
      <StyleBtn
        active={allAlignEnd}
        onClick={() => onPatchStyle({ textAlign: endAlign })}
        title={t("templateEditor.alignEnd")}
      >
        <AlignRight className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />
      </StyleBtn>
      <StyleBtn
        active={allAlignJustify}
        onClick={() => onPatchStyle({ textAlign: "justify" })}
        title={t("templateEditor.alignJustify")}
      >
        <AlignJustify className="w-4 h-4" aria-hidden="true" />
      </StyleBtn>
    </div>
  );
}
