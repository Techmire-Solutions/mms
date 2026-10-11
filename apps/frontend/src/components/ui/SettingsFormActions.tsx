import React from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SettingsFormActionsProps {
  saveLabel: string;
  savingLabel?: string;
  onSave?: () => void;
  onDiscard?: () => void;
  discardLabel?: string;
  dirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  saveDisabled?: boolean;
  showSave?: boolean;
  children?: React.ReactNode;
}

/**
 * Consistent Save and Discard actions for `/settings` panels.
 */
export function SettingsFormActions({
  saveLabel,
  savingLabel,
  onSave,
  onDiscard,
  discardLabel,
  dirty = false,
  saving = false,
  saved: _saved = false,
  saveDisabled = false,
  showSave = true,
  children,
}: SettingsFormActionsProps): React.JSX.Element {
  const saveText = saving ? (savingLabel ?? saveLabel) : saveLabel;

  if (!showSave || !onSave) {
    return children || (dirty && onDiscard) ? (
      <div className="flex w-full items-center justify-end gap-3 border-t border-border/40 mt-6 pt-4">
        {dirty && onDiscard && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={saving}
            className="min-h-11 gap-2 px-4"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            <span>{discardLabel ?? "Discard Changes"}</span>
          </Button>
        )}
        {children}
      </div>
    ) : (
      <></>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-border/40 mt-6 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {dirty && onDiscard && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={saving}
            className="min-h-11 gap-2 px-4"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            <span>{discardLabel ?? "Discard Changes"}</span>
          </Button>
        )}
        {children}
      </div>
      <Button
        type="button"
        onClick={onSave}
        disabled={saveDisabled || !dirty || saving}
        className="min-h-11 gap-2 px-5 py-2.5 ms-auto font-semibold shadow-xs"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Save className="h-3.5 w-3.5" aria-hidden />
        )}
        <span>{saveText}</span>
      </Button>
    </div>
  );
}
