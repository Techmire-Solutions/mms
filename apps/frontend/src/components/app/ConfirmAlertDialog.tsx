import React, { useEffect, useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/FormField";

export interface ConfirmAlertDialogOptionalReason {
  label: string;
  placeholder: string;
  maxLength?: number;
}

export interface ConfirmAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Return `false` to keep the dialog open (e.g. delete guard blocked).
   * `void` / `true` / resolved non-false closes the dialog.
   */
  onConfirm: (reason?: string) => void | boolean | Promise<void | boolean>;
  destructive?: boolean;
  optionalReason?: ConfirmAlertDialogOptionalReason;
  /** Extra fields rendered between the description and the footer. */
  children?: React.ReactNode;
}

/** Accessible confirmation dialog — replaces `window.confirm` in module flows. */
export function ConfirmAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = false,
  optionalReason,
  children,
}: ConfirmAlertDialogProps): React.JSX.Element {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const reasonInputId = useId();

  useEffect(() => {
    if (!open) {
      setReason("");
      setConfirming(false);
    }
  }, [open]);

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    // Prevent Radix auto-close so callers can keep the dialog open on guard failure.
    event.preventDefault();
    if (confirming) return;
    setConfirming(true);
    try {
      const trimmed = reason.trim();
      const result = await Promise.resolve(
        onConfirm(optionalReason ? trimmed || undefined : undefined),
      );
      if (result !== false) {
        onOpenChange(false);
      }
    } finally {
      setConfirming(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {optionalReason && (
          <Field label={optionalReason.label} id={reasonInputId}>
            <Textarea
              id={reasonInputId}
              rows={2}
              value={reason}
              maxLength={optionalReason.maxLength ?? 500}
              placeholder={optionalReason.placeholder}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        )}
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>
            {cancelLabel ?? t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={confirming}
            className={buttonVariants({ variant: destructive ? "destructive" : "default" })}
          >
            {confirmLabel ?? t("common.yes")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
