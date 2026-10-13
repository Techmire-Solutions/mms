import React from "react";
import { Link } from "react-router-dom";
import { PasswordInput } from "@/components/app/PasswordInput";
import { FORM_ERROR } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

export function AuthForgotPasswordLink({
  to,
  label,
}: {
  to: string;
  label: string;
}): React.JSX.Element {
  return (
    <div className="flex justify-end pt-0.5">
      <Link
        to={to}
        className="inline-flex min-h-11 items-center rounded-md px-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
      >
        {label}
      </Link>
    </div>
  );
}

export function AuthPasswordField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  autoFocus,
  autoComplete = "current-password",
  placeholder,
  required = true,
  forgotPasswordTo,
  forgotPasswordLabel,
  name = "password",
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  forgotPasswordTo?: string;
  forgotPasswordLabel?: string;
  name?: string;
  describedBy?: string;
}): React.JSX.Element {
  const errorId = `${id}-error`;
  const describedByIds =
    [error ? errorId : null, describedBy ?? null].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <PasswordInput
        id={id}
        name={name}
        label={label}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedByIds}
        className={cn(error && "border-destructive focus-visible:ring-destructive/25")}
      />
      {error ? (
        <p id={errorId} className={FORM_ERROR} role="alert">
          {error}
        </p>
      ) : null}
      {forgotPasswordTo && forgotPasswordLabel ? (
        <AuthForgotPasswordLink to={forgotPasswordTo} label={forgotPasswordLabel} />
      ) : null}
    </>
  );
}
