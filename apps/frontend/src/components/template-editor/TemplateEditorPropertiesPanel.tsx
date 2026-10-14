/**
 * @file TemplateEditorPropertiesPanel.tsx
 * @description Inspector sidebar panel for configuring element properties, styles, position, alignment, and layers.
 */

import React, { useState } from "react";
import type { ElementStyle, TemplateElement, TemplateFieldDefinition } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { AlignmentType } from "./templateEditorUtils";
import { TemplateEditorMultiSelectPanel } from "./TemplateEditorMultiSelectPanel";
import { TemplateEditorElementIdentitySection } from "./TemplateEditorElementIdentitySection";
import { TemplateEditorPropertiesEmptyState } from "./TemplateEditorPropertiesEmptyState";
import { TemplateEditorPropertiesHeader } from "./TemplateEditorPropertiesHeader";
import { TemplateEditorSingleElementSections } from "./TemplateEditorSingleElementSections";

export interface TemplateEditorPropertiesPanelProps<TPayload = Record<string, unknown>> {
  selectedElement: TemplateElement<keyof TPayload & string> | undefined;
  selectedElements?: TemplateElement<keyof TPayload & string>[];
  elements?: TemplateElement<keyof TPayload & string>[];
  availableFields?: TemplateFieldDefinition<TPayload>[];
  onSelectElement?: (elementId: string) => void;
  onPatchElement: (
    elementId: string,
    patch: Partial<TemplateElement<keyof TPayload & string>>,
  ) => void;
  onPatchStyle: (elementId: string, stylePatch: Partial<ElementStyle>) => void;
  onDuplicateElement: (elementId: string) => void;
  onDeleteElement: (elementId: string) => void;
  onDuplicateSelected?: () => void;
  onDeleteSelected?: () => void;
  onAlignSelected?: (alignType: AlignmentType) => void;
  onDistributeSelected?: (axis: "horizontal" | "vertical") => void;
  onCenterSelected?: (axis: "both" | "h" | "v") => void;
  onSnapSelected?: (edge: "top" | "bottom" | "left" | "right") => void;
  onBringToFront?: (elementId?: string) => void;
  onSendToBack?: (elementId?: string) => void;
  onBringSelectedToFront?: () => void;
  onSendSelectedToBack?: () => void;
  onMoveForward?: (elementId?: string) => void;
  onMoveBackward?: (elementId?: string) => void;
  onPatchSelectedStyles?: (stylePatch: Partial<ElementStyle>) => void;
  primaryColor?: string;
  secondaryColor?: string;
  isRtl?: boolean;
  t: TranslationFunction;
}

export function TemplateEditorPropertiesPanel<TPayload = Record<string, unknown>>({
  selectedElement,
  selectedElements = [],
  elements = [],
  availableFields = [],
  onSelectElement,
  onPatchElement,
  onPatchStyle,
  onDuplicateElement,
  onDeleteElement,
  onDuplicateSelected,
  onDeleteSelected,
  onAlignSelected,
  onDistributeSelected,
  onCenterSelected,
  onSnapSelected,
  onBringToFront,
  onSendToBack,
  onBringSelectedToFront,
  onSendSelectedToBack,
  onMoveForward,
  onMoveBackward,
  onPatchSelectedStyles,
  primaryColor,
  secondaryColor,
  isRtl = false,
  t,
}: TemplateEditorPropertiesPanelProps<TPayload>): React.JSX.Element {
  const [openSections, setOpenSections] = useState({
    position: true,
    layers: true,
    appearance: true,
    typography: true,
    table: false,
    layerList: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isMultiSelect = selectedElements.length > 1;

  if (isMultiSelect) {
    return (
      <TemplateEditorMultiSelectPanel
        selectedElements={selectedElements}
        onAlignSelected={onAlignSelected}
        onDistributeSelected={onDistributeSelected}
        onCenterSelected={onCenterSelected}
        onSnapSelected={onSnapSelected}
        onBringToFront={
          onBringSelectedToFront || (onBringToFront ? () => onBringToFront() : undefined)
        }
        onSendToBack={onSendSelectedToBack || (onSendToBack ? () => onSendToBack() : undefined)}
        onDuplicateSelected={onDuplicateSelected}
        onDeleteSelected={onDeleteSelected}
        onPatchSelectedStyles={onPatchSelectedStyles}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        isRtl={isRtl}
        t={t}
      />
    );
  }

  if (!selectedElement) {
    return (
      <TemplateEditorPropertiesEmptyState
        elements={elements}
        onSelectElement={onSelectElement}
        t={t}
      />
    );
  }

  return (
    <aside
      aria-label={t("templateEditor.properties")}
      className="max-h-64 w-full shrink-0 space-y-4 overflow-y-auto border-t border-border bg-card p-3 lg:max-h-none lg:w-60 lg:border-t-0 lg:border-s print:hidden"
    >
      <TemplateEditorPropertiesHeader
        selectedElement={selectedElement}
        onDuplicateElement={onDuplicateElement}
        onDeleteElement={onDeleteElement}
        t={t}
      />

      <TemplateEditorElementIdentitySection
        selectedElement={selectedElement}
        availableFields={availableFields}
        onPatchElement={onPatchElement}
        t={t}
      />

      <TemplateEditorSingleElementSections
        selectedElement={selectedElement}
        elements={elements}
        openSections={openSections}
        toggleSection={toggleSection}
        onSelectElement={onSelectElement}
        onPatchElement={onPatchElement}
        onPatchStyle={onPatchStyle}
        onCenterSelected={onCenterSelected}
        onSnapSelected={onSnapSelected}
        onBringToFront={onBringToFront}
        onSendToBack={onSendToBack}
        onMoveForward={onMoveForward}
        onMoveBackward={onMoveBackward}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        isRtl={isRtl}
        t={t}
      />
    </aside>
  );
}
