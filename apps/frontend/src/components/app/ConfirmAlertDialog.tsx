import React from "react";
import {
  ConfirmAlertDialog as SharedConfirmAlertDialog,
  type ConfirmAlertDialogProps as SharedConfirmAlertDialogProps,
  type ConfirmAlertDialogOptionalReason,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

export type { ConfirmAlertDialogOptionalReason };
export type ConfirmAlertDialogProps = SharedConfirmAlertDialogProps;

/**
 * Localized facade for ConfirmAlertDialog in Tenant Console.
 * Injects translated strings for standard confirm and cancel buttons.
 */
export function ConfirmAlertDialog({
  confirmLabel,
  cancelLabel,
  ...props
}: ConfirmAlertDialogProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SharedConfirmAlertDialog
      confirmLabel={confirmLabel ?? t("common.yes")}
      cancelLabel={cancelLabel ?? t("common.cancel")}
      {...props}
    />
  );
}

ConfirmAlertDialog.displayName = "ConfirmAlertDialog";
