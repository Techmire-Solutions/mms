import React from "react";
import { Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorHistoryControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  historyLength: number;
  futureLength: number;
  saving?: boolean;
  t: TranslationFunction;
}

const TOOLBAR_ICON_BUTTON =
  "touch-manipulation rounded-md transition-all shadow-none min-h-11 min-w-11";

export function TemplateEditorHistoryControls({
  onUndo,
  onRedo,
  historyLength,
  futureLength,
  saving,
  t,
}: TemplateEditorHistoryControlsProps) {
  return (
    <div
      role="group"
      aria-label={t("templateEditor.history")}
      className="flex items-center gap-0.5 shrink-0"
    >
      <Button
        type="button"
        onClick={onUndo}
        disabled={!historyLength || saving}
        title={t("templateEditor.undo")}
        aria-label={t("templateEditor.undo")}
        variant="ghost"
        size="icon"
        className={`${TOOLBAR_ICON_BUTTON} hover:bg-muted disabled:opacity-30`}
      >
        <Undo2 className="w-4 h-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        onClick={onRedo}
        disabled={!futureLength || saving}
        title={t("templateEditor.redo")}
        aria-label={t("templateEditor.redo")}
        variant="ghost"
        size="icon"
        className={`${TOOLBAR_ICON_BUTTON} hover:bg-muted disabled:opacity-30`}
      >
        <Redo2 className="w-4 h-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
