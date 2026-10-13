import React from "react";
import { CheckCheck, Loader2, Maximize2, Minimize2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorHeaderActionsProps {
  onResetDefault: () => void;
  onToggleFullscreen?: () => void;
  fullscreen?: boolean;
  onSave: () => void;
  onClose: () => void;
  saved: boolean;
  saving?: boolean;
  t: TranslationFunction;
}

/** Shared sizing for every control in the toolbar — one 44px row, no exceptions. */
const TOOLBAR_ICON_BUTTON =
  "touch-manipulation rounded-md transition-all shadow-none min-h-11 min-w-11";

export function TemplateEditorHeaderActions({
  onResetDefault,
  onToggleFullscreen,
  fullscreen = false,
  onSave,
  onClose,
  saved,
  saving = false,
  t,
}: TemplateEditorHeaderActionsProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={t("templateEditor.documentActions")}
      className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 border-s border-border/50 bg-card/95 backdrop-blur-sm"
    >
      <Button
        type="button"
        onClick={onResetDefault}
        disabled={saving}
        variant="ghost"
        size="icon"
        className={`${TOOLBAR_ICON_BUTTON} text-muted-foreground hover:text-foreground hover:bg-muted`}
        title={t("templateEditor.resetDefault")}
        aria-label={t("templateEditor.resetDefault")}
      >
        <RotateCcw className="w-4 h-4" aria-hidden="true" />
      </Button>

      {onToggleFullscreen && (
        <Button
          type="button"
          onClick={onToggleFullscreen}
          aria-pressed={fullscreen}
          variant="ghost"
          size="icon"
          className={`${TOOLBAR_ICON_BUTTON} text-muted-foreground hover:text-foreground hover:bg-muted`}
          title={t("templateEditor.toggleFullscreen")}
          aria-label={t("templateEditor.toggleFullscreen")}
        >
          {fullscreen ? (
            <Minimize2 className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="w-4 h-4" aria-hidden="true" />
          )}
        </Button>
      )}

      <div className="h-6 w-px bg-border/60 mx-1 shrink-0" aria-hidden="true" />

      {/* Save button — animated success state & loading spinner */}
      <Button
        type="button"
        onClick={onSave}
        disabled={saving}
        aria-busy={saving}
        aria-label={
          saving ? t("global.saving") : saved ? t("templateEditor.saved") : t("templateEditor.save")
        }
        className={`min-h-11 h-11 px-3.5 text-xs font-semibold rounded-lg transition-all duration-300 shadow-none flex items-center gap-1.5 ${
          saved
            ? "bg-success hover:bg-success text-success-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>{t("global.saving")}</span>
          </>
        ) : saved ? (
          <>
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            <span>{t("templateEditor.saved")}</span>
          </>
        ) : (
          <>
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{t("templateEditor.save")}</span>
          </>
        )}
      </Button>

      <Button
        type="button"
        onClick={onClose}
        disabled={saving}
        variant="outline"
        title={t("templateEditor.close")}
        aria-label={t("templateEditor.close")}
        className="min-h-11 h-11 px-3 text-xs font-medium rounded-lg border-border hover:bg-muted transition-all shadow-none"
      >
        {t("templateEditor.close")}
      </Button>
    </div>
  );
}
