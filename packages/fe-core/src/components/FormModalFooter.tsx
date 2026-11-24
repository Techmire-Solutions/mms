import React from "react";
import { CheckCircle2, Save } from "lucide-react";
import { Button } from "@mms/ui";
import { cn } from "@mms/ui";

export interface FormModalFooterProps {
  footerStart?: React.ReactNode;
  cancelLabel: string;
  saveLabel: string;
  savedLabel?: string;
  onClose: () => void;
  onSave?: (options?: { keepOpen?: boolean }) => void | Promise<unknown>;
  saving: boolean;
  saveDisabled: boolean;
  saved: boolean;
  form?: string;
  saveVariant?: "primary" | "destructive";
}

export const FormModalFooter = function FormModalFooter({
  footerStart,
  cancelLabel,
  saveLabel,
  savedLabel,
  onClose,
  onSave,
  saving,
  saveDisabled,
  saved,
  form,
  saveVariant = "primary",
}: FormModalFooterProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-stretch gap-2.5 sm:flex-row sm:items-center",
        footerStart ? "justify-between" : "justify-end",
      )}
    >
      {footerStart ? <div className="min-w-0 sm:flex-1">{footerStart}</div> : null}
      <div className="w-full sm:w-auto sm:ms-auto flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {cancelLabel}
        </Button>
        <Button
          type={form ? "submit" : "button"}
          variant={saveVariant}
          form={form}
          onClick={
            form
              ? undefined
              : () => {
                  void onSave?.();
                }
          }
          disabled={saving || saveDisabled || saved}
          loading={saving}
          loadingText={saveLabel}
          className="w-full sm:w-auto min-w-filter-sm"
        >
          {saved ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {savedLabel ?? saveLabel}
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              {saveLabel}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
