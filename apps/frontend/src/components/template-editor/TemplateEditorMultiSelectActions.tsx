import React from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorMultiSelectActionsProps {
  selectedCount: number;
  onDuplicateSelected?: () => void;
  onDeleteSelected?: () => void;
  t: TranslationFunction;
}

export function TemplateEditorMultiSelectActions({
  selectedCount,
  onDuplicateSelected,
  onDeleteSelected,
  t,
}: TemplateEditorMultiSelectActionsProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={t("common.actions")}
      className="flex gap-2 pt-2 border-t border-border"
    >
      <Button
        type="button"
        variant="outline"
        onClick={onDuplicateSelected}
        className="flex-1 text-xs min-h-11 border-border hover:bg-muted flex items-center justify-center gap-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
        title={t("templateEditor.duplicate")}
        aria-label={t("templateEditor.duplicate")}
      >
        <Copy className="w-4 h-4" aria-hidden="true" />
        <span>{t("templateEditor.duplicate")}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onDeleteSelected}
        className="flex-1 text-xs min-h-11 border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center justify-center gap-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
        title={`${t("templateEditor.delete")} (${selectedCount})`}
        aria-label={`${t("templateEditor.delete")} (${selectedCount})`}
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
        <span>
          {t("templateEditor.delete")} ({selectedCount})
        </span>
      </Button>
    </div>
  );
}
