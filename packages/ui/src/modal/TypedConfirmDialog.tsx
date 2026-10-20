import React, { useId } from "react";
import { Button } from "../button/Button";
import { Input } from "../input/Input";
import { PasswordInput } from "../input/PasswordInput";
import { Field, FieldErrorMessage } from "../input/FormField";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./AlertDialog";

export interface TypedConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Expected confirmation string (literal token, name, or subdomain). */
  expectedConfirm?: string;
  confirmValue?: string;
  onConfirmValueChange?: (value: string) => void;
  confirmInputName?: string;
  confirmPlaceholder?: string;
  password?: string;
  onPasswordChange?: (value: string) => void;
  passwordInputId?: string;
  passwordInputName?: string;
  passwordLabel?: string;
  passwordHint?: string;
  error?: string | null;
  pending?: boolean;
  cancelLabel?: string;
  confirmButtonLabel: string;
  confirmVariant?: "default" | "destructive";
  /** How confirm text must match `expectedConfirm`. Default: exact. */
  confirmMatch?: "exact" | "caseInsensitive";
  destructiveTitle?: boolean;
  onConfirm: () => void;
}

function confirmMatches(
  value: string,
  expected: string,
  mode: "exact" | "caseInsensitive",
): boolean {
  if (mode === "caseInsensitive") {
    return value.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  return value.trim() === expected;
}

/**
 * Universal TypedConfirmDialog primitive.
 * Presentational typed confirmation modal with optional password step-up authentication.
 * Blocks dismissal while pending. Calls onConfirm when criteria match.
 */
export function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  expectedConfirm,
  confirmValue,
  onConfirmValueChange,
  confirmInputName = "confirmText",
  confirmPlaceholder,
  password,
  onPasswordChange,
  passwordInputId = "confirm-password",
  passwordInputName = "currentPassword",
  passwordLabel = "Current Password",
  passwordHint,
  error = null,
  pending = false,
  cancelLabel = "Cancel",
  confirmButtonLabel,
  confirmVariant = "destructive",
  confirmMatch = "exact",
  destructiveTitle = true,
  onConfirm,
}: TypedConfirmDialogProps): React.JSX.Element {
  const confirmInputId = useId();
  const formId = useId();
  const hasTypedConfirm = Boolean(expectedConfirm && onConfirmValueChange);
  const matches =
    !hasTypedConfirm || confirmMatches(confirmValue ?? "", expectedConfirm ?? "", confirmMatch);
  const requiresPassword = typeof password === "string" && onPasswordChange !== undefined;
  const passwordValid = !requiresPassword || password.trim().length > 0;
  const canConfirm = !pending && matches && passwordValid;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (canConfirm) {
      onConfirm();
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending && !nextOpen) return;
        onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle
            className={
              destructiveTitle ? "text-destructive font-bold text-balance" : "font-bold text-balance"
            }
          >
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-pretty">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form id={formId} noValidate onSubmit={handleSubmit} className="space-y-3 my-2 text-start">
          {hasTypedConfirm && confirmLabel && onConfirmValueChange ? (
            <Field id={confirmInputId} label={confirmLabel}>
              <Input
                id={confirmInputId}
                name={confirmInputName}
                type="text"
                value={confirmValue ?? ""}
                onChange={(event) => onConfirmValueChange(event.target.value)}
                placeholder={confirmPlaceholder}
                disabled={pending}
                className="min-h-11"
                autoComplete="off"
              />
            </Field>
          ) : null}
          {requiresPassword && onPasswordChange ? (
            <>
              <PasswordInput
                id={passwordInputId}
                name={passwordInputName}
                label={passwordLabel}
                autoComplete="current-password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                disabled={pending}
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error
                    ? `${passwordInputId}-error`
                    : passwordHint
                      ? `${passwordInputId}-hint`
                      : undefined
                }
              />
              {passwordHint ? (
                <p id={`${passwordInputId}-hint`} className="text-xs text-muted-foreground text-pretty">
                  {passwordHint}
                </p>
              ) : null}
            </>
          ) : null}
          {error ? <FieldErrorMessage id={`${passwordInputId}-error`} message={error} /> : null}
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="min-h-11 rounded-xl font-bold">
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="submit"
            form={formId}
            variant={confirmVariant}
            disabled={!canConfirm}
            loading={pending}
            onClick={(event) => {
              event.preventDefault();
              if (canConfirm) {
                onConfirm();
              }
            }}
          >
            {confirmButtonLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

TypedConfirmDialog.displayName = "TypedConfirmDialog";
