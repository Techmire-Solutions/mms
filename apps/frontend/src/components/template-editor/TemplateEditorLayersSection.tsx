import React from "react";
import { Layers, ArrowUpToLine, ChevronUp, ChevronDown, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { TemplateEditorSection } from "./TemplateEditorSection";

export interface TemplateEditorLayersSectionProps {
  elementId: string;
  isOpen: boolean;
  onToggle: () => void;
  onBringToFront: (elementId: string) => void;
  onMoveForward?: (elementId?: string) => void;
  onMoveBackward?: (elementId?: string) => void;
  onSendToBack?: (elementId?: string) => void;
  t: TranslationFunction;
}

export function TemplateEditorLayersSection({
  elementId,
  isOpen,
  onToggle,
  onBringToFront,
  onMoveForward,
  onMoveBackward,
  onSendToBack,
  t,
}: TemplateEditorLayersSectionProps): React.JSX.Element {
  return (
    <TemplateEditorSection
      titleKey="templateEditor.layerStacking"
      icon={Layers}
      isOpen={isOpen}
      onToggle={onToggle}
      t={t}
    >
      <div
        role="group"
        aria-label={t("templateEditor.layerStacking")}
        className="grid grid-cols-4 gap-1"
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => onBringToFront(elementId)}
          className="min-h-11 min-w-11 p-0 flex items-center justify-center rounded-lg border border-border hover:bg-muted"
          title={t("templateEditor.bringToFront")}
          aria-label={t("templateEditor.bringToFront")}
        >
          <ArrowUpToLine className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onMoveForward?.(elementId)}
          className="min-h-11 min-w-11 p-0 flex items-center justify-center rounded-lg border border-border hover:bg-muted"
          title={t("templateEditor.moveForward")}
          aria-label={t("templateEditor.moveForward")}
        >
          <ChevronUp className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onMoveBackward?.(elementId)}
          className="min-h-11 min-w-11 p-0 flex items-center justify-center rounded-lg border border-border hover:bg-muted"
          title={t("templateEditor.moveBackward")}
          aria-label={t("templateEditor.moveBackward")}
        >
          {/* ChevronDown is visually the "move down one level" affordance here. */}
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onSendToBack?.(elementId)}
          className="min-h-11 min-w-11 p-0 flex items-center justify-center rounded-lg border border-border hover:bg-muted"
          title={t("templateEditor.sendToBack")}
          aria-label={t("templateEditor.sendToBack")}
        >
          <ArrowDownToLine className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </TemplateEditorSection>
  );
}
