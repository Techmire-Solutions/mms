import React from "react";
import { AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { TemplateEditorSection } from "./TemplateEditorSection";

export interface TemplateEditorMultiSelectDistributeProps {
  isOpen: boolean;
  onToggle: () => void;
  onDistributeSelected: (axis: "horizontal" | "vertical") => void;
  t: TranslationFunction;
}

export function TemplateEditorMultiSelectDistribute({
  isOpen,
  onToggle,
  onDistributeSelected,
  t,
}: TemplateEditorMultiSelectDistributeProps): React.JSX.Element {
  return (
    <TemplateEditorSection
      titleKey="templateEditor.distribute"
      icon={AlignHorizontalDistributeCenter}
      isOpen={isOpen}
      onToggle={onToggle}
      t={t}
      panelClassName="space-y-1.5"
    >
      <div
        role="group"
        aria-label={t("templateEditor.distribute")}
        className="grid grid-cols-2 gap-1.5"
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => onDistributeSelected("horizontal")}
          title={t("templateEditor.distributeHorizontally")}
          aria-label={t("templateEditor.distributeHorizontally")}
          className="min-h-11 min-w-11 p-0 rounded-lg border-border hover:bg-muted flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
        >
          <AlignHorizontalDistributeCenter className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onDistributeSelected("vertical")}
          title={t("templateEditor.distributeVertically")}
          aria-label={t("templateEditor.distributeVertically")}
          className="min-h-11 min-w-11 p-0 rounded-lg border-border hover:bg-muted flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
        >
          <AlignVerticalDistributeCenter className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </TemplateEditorSection>
  );
}
