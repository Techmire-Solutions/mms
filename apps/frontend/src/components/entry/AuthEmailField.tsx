import React from "react";
import { Mail } from "lucide-react";
import { AuthTextField } from "@/components/entry/AuthTextField";

/** Email field — thin SSOT wrapper over AuthTextField. */
export function AuthEmailField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  autoFocus,
  autoComplete = "email",
  placeholder,
  required = true,
  enterKeyHint = "next",
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
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
}): React.JSX.Element {
  return (
    <AuthTextField
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      disabled={disabled}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      placeholder={placeholder}
      required={required}
      type="email"
      name="email"
      inputMode="email"
      enterKeyHint={enterKeyHint}
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      icon={Mail}
    />
  );
}
