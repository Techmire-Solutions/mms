import * as React from "react";
import { cn } from "../utils";

export const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 min-h-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 user-invalid:border-destructive user-invalid:focus-visible:ring-destructive/30 user-invalid:focus-visible:border-destructive disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation transition-colors";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
  showValidState?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      id,
      name,
      error,
      showValidState,
      leftIcon,
      rightIcon,
      onBlur,
      onInput,
      ...props
    },
    ref,
  ) => {
    const fallbackId = React.useId();
    const resolvedId = id || fallbackId;
    const resolvedName = name || fallbackId;
    const hasError = Boolean(error);

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      onBlur?.(e);
      if (!hasError && e.currentTarget.checkValidity) {
        if (!e.currentTarget.checkValidity()) {
          e.currentTarget.setAttribute("aria-invalid", "true");
        } else if (e.currentTarget.getAttribute("aria-invalid") === "true") {
          e.currentTarget.removeAttribute("aria-invalid");
        }
      }
    };

    const handleInput = (
      e: Parameters<NonNullable<React.InputHTMLAttributes<HTMLInputElement>["onInput"]>>[0],
    ) => {
      onInput?.(e);
      if (!hasError && e.currentTarget.checkValidity && e.currentTarget.getAttribute("aria-invalid") === "true") {
        if (e.currentTarget.checkValidity()) {
          e.currentTarget.removeAttribute("aria-invalid");
        }
      }
    };

    const inputElement = (
      <input
        type={type}
        id={resolvedId}
        name={resolvedName}
        className={cn(
          INPUT_CLASS,
          leftIcon && "ps-9",
          rightIcon && "pe-9",
          hasError &&
            "border-destructive focus-visible:ring-destructive focus-visible:border-destructive",
          showValidState &&
            "user-valid:border-success/60 user-valid:focus-visible:border-success user-valid:focus-visible:ring-success/20",
          className,
        )}
        ref={ref}
        aria-invalid={hasError || undefined}
        onBlur={handleBlur}
        onInput={handleInput}
        {...props}
      />
    );

    if (!leftIcon && !rightIcon) {
      return inputElement;
    }

    return (
      <div className="relative flex w-full items-center">
        {leftIcon && (
          <div className="pointer-events-none absolute start-3 flex items-center justify-center text-muted-foreground [&_svg]:size-4">
            {leftIcon}
          </div>
        )}
        {inputElement}
        {rightIcon && (
          <div className="pointer-events-none absolute end-3 flex items-center justify-center text-muted-foreground [&_svg]:size-4">
            {rightIcon}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
