import React from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorPropertiesHeaderProps<TPayload = Record<string, unknown>> {
  selectedElement: TemplateElement<keyof TPayload & string>;
  onDuplicateElement: (elementId: string) => void;
  onDeleteElement: (elementId: string) => void;
  t: TranslationFunction;
}

export function TemplateEditorPropertiesHeader<TPayload = Record<string, unknown>>({
  selectedElement,
  onDuplicateElement,
  onDeleteElement,
  t,
}: TemplateEditorPropertiesHeaderProps<TPayload>): React.JSX.Element {
  return (
    <div className="pb-2 border-b border-border/80 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-2xs font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {selectedElement.type}
        </span>
        <span className="text-xs font-semibold text-foreground truncate max-w-32">
          {selectedElement.label || t("templateEditor.element")}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDuplicateElement(selectedElement.id)}
          className="min-h-11 min-w-11 text-muted-foreground hover:text-foreground rounded"
          title={t("templateEditor.duplicate")}
          aria-label={t("templateEditor.duplicate")}
        >
          <Copy className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDeleteElement(selectedElement.id)}
          className="min-h-11 min-w-11 text-destructive hover:bg-destructive/10 rounded"
          title={t("templateEditor.delete")}
          aria-label={t("templateEditor.delete")}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
