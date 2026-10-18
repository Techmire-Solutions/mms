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
} from "./AlertDialog";
import { buttonVariants } from "../button/Button";
import { Textarea } from "../input/Textarea";
import { Field } from "../input/FormField";

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

/**
 * Accessible confirmation dialog — replaces window.confirm across interactive workflows.
 * Supports delete guards, asynchronous handlers, destructive tones, and optional reason inputs.
 */
export function ConfirmAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = false,
  optionalReason,
  children,
}: ConfirmAlertDialogProps): React.JSX.Element {
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
          <AlertDialogCancel disabled={confirming}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={confirming}
            className={buttonVariants({ variant: destructive ? "destructive" : "default" })}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

ConfirmAlertDialog.displayName = "ConfirmAlertDialog";
