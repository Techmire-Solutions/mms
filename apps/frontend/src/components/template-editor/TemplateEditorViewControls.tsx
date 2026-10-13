import React from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorViewControlsProps {
  showGuides: boolean;
  isPreviewMode?: boolean;
  onToggleGuides: () => void;
  onTogglePreview?: () => void;
  iconButtonClassName?: string;
  t: TranslationFunction;
}

const DEFAULT_ICON_BUTTON =
  "touch-manipulation rounded-md transition-all shadow-none min-h-11 min-w-11";

export function TemplateEditorViewControls({
  showGuides,
  isPreviewMode = false,
  onToggleGuides,
  onTogglePreview,
  iconButtonClassName = DEFAULT_ICON_BUTTON,
  t,
}: TemplateEditorViewControlsProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={t("templateEditor.viewOptions")}
      className="flex items-center gap-0.5 shrink-0"
    >
      <Button
        type="button"
        onClick={onToggleGuides}
        aria-pressed={showGuides}
        aria-label={t("templateEditor.toggleGuides")}
        title={t("templateEditor.toggleGuides")}
        variant="ghost"
        size="icon"
        className={`${iconButtonClassName} ${
          showGuides
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {showGuides ? (
          <Eye className="w-4 h-4" aria-hidden="true" />
        ) : (
          <EyeOff className="w-4 h-4" aria-hidden="true" />
        )}
      </Button>

      {onTogglePreview && (
        <Button
          type="button"
          onClick={onTogglePreview}
          aria-pressed={isPreviewMode}
          aria-label={
            isPreviewMode ? t("templateEditor.switchToEdit") : t("templateEditor.switchToPreview")
          }
          title={
            isPreviewMode ? t("templateEditor.switchToEdit") : t("templateEditor.switchToPreview")
          }
          variant="ghost"
          size="icon"
          className={`${iconButtonClassName} ${
            isPreviewMode
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {isPreviewMode ? (
            <Pencil className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </Button>
      )}
    </div>
  );
}
