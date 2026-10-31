import React from "react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FORM_ERROR, FORM_LABEL } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

/** Shared labeled text/email field with optional leading icon — SSOT for auth entry inputs. */
export function AuthTextField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  autoFocus,
  autoComplete,
  placeholder,
  required = true,
  type = "text",
  name,
  inputMode,
  icon: Icon,
  spellCheck,
  autoCapitalize,
  autoCorrect,
  enterKeyHint,
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
  type?: React.HTMLInputTypeAttribute;
  name?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  icon?: LucideIcon;
  spellCheck?: boolean;
  autoCapitalize?: string;
  autoCorrect?: string;
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
}): React.JSX.Element {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5 text-start">
      <label htmlFor={id} className={FORM_LABEL}>
        {label}
      </label>
      <div className="relative">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        ) : null}
        <Input
          id={id}
          type={type}
          name={name}
          autoComplete={autoComplete}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          autoFocus={autoFocus}
          spellCheck={spellCheck}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          required={required}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          aria-errormessage={error ? errorId : undefined}
          className={cn(
            "h-11",
            Icon && "ps-9",
            error && "border-destructive focus-visible:ring-destructive/25",
          )}
        />
      </div>
      {error ? (
        <p id={errorId} className={FORM_ERROR} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
