import React from "react";
import {
  TypedConfirmDialog as SharedTypedConfirmDialog,
  type TypedConfirmDialogProps as SharedTypedConfirmDialogProps,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

export type TypedConfirmDialogProps = SharedTypedConfirmDialogProps;

/**
 * Universal TypedConfirmDialog primitive facade.
 * Re-exports @shared/ui TypedConfirmDialog with application-level i18n defaults.
 */
export function TypedConfirmDialog(props: TypedConfirmDialogProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <SharedTypedConfirmDialog
      cancelLabel={props.cancelLabel ?? t("common.cancel")}
      passwordLabel={props.passwordLabel ?? t("platform.profileCurrentPassword")}
      {...props}
    />
  );
}

TypedConfirmDialog.displayName = "TypedConfirmDialog";

export default TypedConfirmDialog;
