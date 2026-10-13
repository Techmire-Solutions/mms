import React from "react";
import { ArrowDownToLine, ArrowUpToLine, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { TemplateEditorSection } from "./TemplateEditorSection";

export interface TemplateEditorMultiSelectLayersProps {
  isOpen: boolean;
  onToggle: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  t: TranslationFunction;
}

export function TemplateEditorMultiSelectLayers({
  isOpen,
  onToggle,
  onBringToFront,
  onSendToBack,
  t,
}: TemplateEditorMultiSelectLayersProps): React.JSX.Element {
  return (
    <TemplateEditorSection
      titleKey="templateEditor.layerOrdering"
      icon={Layers}
      isOpen={isOpen}
      onToggle={onToggle}
      t={t}
      panelClassName="space-y-1.5"
    >
      <div
        role="group"
        aria-label={t("templateEditor.layerOrdering")}
        className="grid grid-cols-2 gap-1.5"
      >
        <Button
          type="button"
          variant="outline"
          onClick={onBringToFront}
          className="min-h-11 min-w-11 p-0 rounded-lg border-border hover:bg-muted flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
          title={t("templateEditor.bringToFront")}
          aria-label={t("templateEditor.bringToFront")}
        >
          <ArrowUpToLine className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onSendToBack}
          className="min-h-11 min-w-11 p-0 rounded-lg border-border hover:bg-muted flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
          title={t("templateEditor.sendToBack")}
          aria-label={t("templateEditor.sendToBack")}
        >
          <ArrowDownToLine className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </TemplateEditorSection>
  );
}
