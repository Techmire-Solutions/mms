/**
 * @file TemplateEditorMultiSelectPanel.tsx
 * @description Inspector sidebar panel displayed when multiple template canvas elements are selected.
 */

import React, { useState } from "react";
import { Layers, Move } from "lucide-react";
import type { ElementStyle, TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { normalizeHexColor, type AlignmentType } from "./templateEditorUtils";
import { PRINT_COLORS } from "@/lib/printTemplateStyles";
import { TemplateEditorSection } from "./TemplateEditorSection";
import { TemplateEditorAlignmentGrid } from "./TemplateEditorAlignmentGrid";
import { TemplateEditorTypographySection } from "./TemplateEditorTypographySection";
import { TemplateEditorMultiSelectCenterSnap } from "./TemplateEditorMultiSelectCenterSnap";
import { TemplateEditorMultiSelectAppearance } from "./TemplateEditorMultiSelectAppearance";
import { TemplateEditorMultiSelectDistribute } from "./TemplateEditorMultiSelectDistribute";
import { TemplateEditorMultiSelectLayers } from "./TemplateEditorMultiSelectLayers";
import { TemplateEditorMultiSelectActions } from "./TemplateEditorMultiSelectActions";

export interface TemplateEditorMultiSelectPanelProps<TPayload = Record<string, unknown>> {
  selectedElements: TemplateElement<keyof TPayload & string>[];
  onAlignSelected?: (alignType: AlignmentType) => void;
  onDistributeSelected?: (axis: "horizontal" | "vertical") => void;
  onCenterSelected?: (axis: "both" | "h" | "v") => void;
  onSnapSelected?: (edge: "top" | "bottom" | "left" | "right") => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onDuplicateSelected?: () => void;
  onDeleteSelected?: () => void;
  onPatchSelectedStyles?: (stylePatch: Partial<ElementStyle>) => void;
  primaryColor?: string;
  secondaryColor?: string;
  isRtl?: boolean;
  t: TranslationFunction;
}

export function TemplateEditorMultiSelectPanel<TPayload = Record<string, unknown>>({
  selectedElements,
  onAlignSelected,
  onDistributeSelected,
  onCenterSelected,
  onSnapSelected,
  onBringToFront,
  onSendToBack,
  onDuplicateSelected,
  onDeleteSelected,
  onPatchSelectedStyles,
  primaryColor,
  secondaryColor,
  isRtl = false,
  t,
}: TemplateEditorMultiSelectPanelProps<TPayload>): React.JSX.Element {
  const [openSections, setOpenSections] = useState({
    alignment: true,
    distribute: true,
    center: true,
    layers: true,
    typography: true,
    appearance: true,
  });
  const toggleSection = (section: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));

  const hasTextLike = selectedElements.some((el) => el.type === "static" || el.type === "field");

  const sampleStyle = selectedElements[0]?.style || {};
  const initialBgColor = normalizeHexColor(sampleStyle.backgroundColor, PRINT_COLORS.white);
  const initialBorderColor = normalizeHexColor(sampleStyle.borderColor, PRINT_COLORS.borderSlate);
  const initialBorderRadius = sampleStyle.borderRadius ?? 0;
  const initialBorderWidth = sampleStyle.borderWidth ?? 0;

  const bounds = React.useMemo(() => {
    if (selectedElements.length === 0) return null;
    const minX = Math.min(...selectedElements.map((el) => el.x));
    const minY = Math.min(...selectedElements.map((el) => el.y));
    const maxX = Math.max(...selectedElements.map((el) => el.x + el.w));
    const maxY = Math.max(...selectedElements.map((el) => el.y + el.h));
    return { w: Math.round(maxX - minX), h: Math.round(maxY - minY) };
  }, [selectedElements]);

  return (
    <aside
      aria-label={t("templateEditor.elementsSelected", { count: selectedElements.length })}
      className="max-h-64 w-full shrink-0 space-y-3 overflow-y-auto border-t border-border bg-card p-3 lg:max-h-none lg:w-60 lg:border-t-0 lg:border-s print:hidden"
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground m-0 truncate">
            {t("templateEditor.elementsSelected", { count: selectedElements.length })}
          </h2>
        </div>
        {bounds && (
          <span
            aria-label={`${bounds.w} by ${bounds.h} px`}
            className="text-3xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0"
          >
            {bounds.w} × {bounds.h} px
          </span>
        )}
      </div>

      <TemplateEditorSection
        titleKey="templateEditor.alignment"
        icon={Move}
        isOpen={openSections.alignment}
        onToggle={() => toggleSection("alignment")}
        t={t}
        panelClassName="space-y-1.5"
      >
        <TemplateEditorAlignmentGrid onAlignSelected={(a) => onAlignSelected?.(a)} t={t} />
      </TemplateEditorSection>

      {onDistributeSelected && selectedElements.length >= 3 && (
        <TemplateEditorMultiSelectDistribute
          isOpen={openSections.distribute}
          onToggle={() => toggleSection("distribute")}
          onDistributeSelected={onDistributeSelected}
          t={t}
        />
      )}

      <TemplateEditorMultiSelectCenterSnap
        isOpen={openSections.center}
        onToggle={() => toggleSection("center")}
        onCenterSelected={onCenterSelected}
        onSnapSelected={onSnapSelected}
        t={t}
      />

      {onBringToFront && onSendToBack && (
        <TemplateEditorMultiSelectLayers
          isOpen={openSections.layers}
          onToggle={() => toggleSection("layers")}
          onBringToFront={onBringToFront}
          onSendToBack={onSendToBack}
          t={t}
        />
      )}

      {hasTextLike && onPatchSelectedStyles && (
        <TemplateEditorTypographySection
          elStyle={sampleStyle}
          selectedElements={selectedElements}
          isOpen={openSections.typography}
          onToggle={() => toggleSection("typography")}
          onPatchStyle={onPatchSelectedStyles}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          isRtl={isRtl}
          t={t}
        />
      )}

      {onPatchSelectedStyles && (
        <TemplateEditorMultiSelectAppearance
          isOpen={openSections.appearance}
          onToggle={() => toggleSection("appearance")}
          initialBgColor={initialBgColor}
          initialBorderColor={initialBorderColor}
          initialBorderRadius={initialBorderRadius}
          initialBorderWidth={initialBorderWidth}
          onPatchSelectedStyles={onPatchSelectedStyles}
          t={t}
        />
      )}

      <TemplateEditorMultiSelectActions
        selectedCount={selectedElements.length}
        onDuplicateSelected={onDuplicateSelected}
        onDeleteSelected={onDeleteSelected}
        t={t}
      />
    </aside>
  );
}
