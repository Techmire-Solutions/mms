import React from "react";
import { Layers } from "lucide-react";
import type { ElementStyle, TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { TemplateEditorTypographySection } from "./TemplateEditorTypographySection";
import { TemplateEditorPositionSection } from "./TemplateEditorPositionSection";
import { TemplateEditorLayersSection } from "./TemplateEditorLayersSection";
import { TemplateEditorAppearanceSection } from "./TemplateEditorAppearanceSection";
import { TemplateEditorTableSection } from "./TemplateEditorTableSection";
import { TemplateEditorLayerList } from "./TemplateEditorLayerList";
import { TemplateEditorSection } from "./TemplateEditorSection";

export interface TemplateEditorSingleElementSectionsProps<TPayload = Record<string, unknown>> {
  selectedElement: TemplateElement<keyof TPayload & string>;
  elements?: TemplateElement<keyof TPayload & string>[];
  openSections: {
    position: boolean;
    layers: boolean;
    appearance: boolean;
    typography: boolean;
    table: boolean;
    layerList: boolean;
  };
  toggleSection: (
    section: "position" | "layers" | "appearance" | "typography" | "table" | "layerList",
  ) => void;
  onSelectElement?: (elementId: string) => void;
  onPatchElement: (
    elementId: string,
    patch: Partial<TemplateElement<keyof TPayload & string>>,
  ) => void;
  onPatchStyle: (elementId: string, stylePatch: Partial<ElementStyle>) => void;
  onCenterSelected?: (axis: "both" | "h" | "v") => void;
  onSnapSelected?: (edge: "top" | "bottom" | "left" | "right") => void;
  onBringToFront?: (elementId?: string) => void;
  onSendToBack?: (elementId?: string) => void;
  onMoveForward?: (elementId?: string) => void;
  onMoveBackward?: (elementId?: string) => void;
  primaryColor?: string;
  secondaryColor?: string;
  isRtl?: boolean;
  t: TranslationFunction;
}

export function TemplateEditorSingleElementSections<TPayload = Record<string, unknown>>({
  selectedElement,
  elements = [],
  openSections,
  toggleSection,
  onSelectElement,
  onPatchElement,
  onPatchStyle,
  onCenterSelected,
  onSnapSelected,
  onBringToFront,
  onSendToBack,
  onMoveForward,
  onMoveBackward,
  primaryColor,
  secondaryColor,
  isRtl = false,
  t,
}: TemplateEditorSingleElementSectionsProps<TPayload>): React.JSX.Element {
  const elStyle = selectedElement.style || {};
  const isTextLike = selectedElement.type === "static" || selectedElement.type === "field";

  return (
    <>
      {onSelectElement && elements.length > 0 && (
        <TemplateEditorSection
          titleKey="templateEditor.layerList"
          icon={Layers}
          isOpen={openSections.layerList}
          onToggle={() => toggleSection("layerList")}
          t={t}
          panelClassName="space-y-1.5"
        >
          <TemplateEditorLayerList
            elements={elements}
            selectedIds={[selectedElement.id]}
            onSelectElement={onSelectElement}
            t={t}
          />
        </TemplateEditorSection>
      )}

      <TemplateEditorPositionSection
        selectedElement={selectedElement}
        isOpen={openSections.position}
        onToggle={() => toggleSection("position")}
        onPatchElement={onPatchElement}
        onCenterSelected={onCenterSelected}
        onSnapSelected={onSnapSelected}
        t={t}
      />

      {onBringToFront && (
        <TemplateEditorLayersSection
          elementId={selectedElement.id}
          isOpen={openSections.layers}
          onToggle={() => toggleSection("layers")}
          onBringToFront={onBringToFront}
          onMoveForward={onMoveForward}
          onMoveBackward={onMoveBackward}
          onSendToBack={onSendToBack}
          t={t}
        />
      )}

      <TemplateEditorAppearanceSection
        elementId={selectedElement.id}
        elStyle={elStyle}
        isOpen={openSections.appearance}
        onToggle={() => toggleSection("appearance")}
        onPatchStyle={onPatchStyle}
        t={t}
      />

      {isTextLike && (
        <TemplateEditorTypographySection
          elementId={selectedElement.id}
          elStyle={elStyle}
          selectedElements={[selectedElement]}
          isOpen={openSections.typography}
          onToggle={() => toggleSection("typography")}
          onPatchStyle={(patch) => onPatchStyle(selectedElement.id, patch)}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          isRtl={isRtl}
          t={t}
        />
      )}

      {selectedElement.type === "table" && (
        <TemplateEditorTableSection
          selectedElement={selectedElement}
          isOpen={openSections.table}
          onToggle={() => toggleSection("table")}
          onPatchElement={onPatchElement}
          t={t}
        />
      )}
    </>
  );
}
