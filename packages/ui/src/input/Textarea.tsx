import * as React from "react";
import { cn } from "../utils";

export const TEXTAREA_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 min-h-20 resize-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 user-invalid:border-destructive user-invalid:focus-visible:ring-destructive/30 user-invalid:focus-visible:border-destructive disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation transition-colors";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string;
  /** Modern Web Guidance: form-fields-automatically-fit-contents — enables field-sizing: content with 3lh-12lh bounds */
  autoResize?: boolean;
  ref?: React.Ref<HTMLTextAreaElement>;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, id, name, error, autoResize, onBlur, onInput, ...props }, ref) => {
    const fallbackId = React.useId();
    const resolvedId = id || fallbackId;
    const resolvedName = name || fallbackId;
    const hasError = Boolean(error);

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
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
      e: Parameters<NonNullable<React.TextareaHTMLAttributes<HTMLTextAreaElement>["onInput"]>>[0],
    ) => {
      onInput?.(e);
      if (
        !hasError &&
        e.currentTarget.checkValidity &&
        e.currentTarget.getAttribute("aria-invalid") === "true"
      ) {
        if (e.currentTarget.checkValidity()) {
          e.currentTarget.removeAttribute("aria-invalid");
        }
      }
    };

    return (
      <textarea
        id={resolvedId}
        name={resolvedName}
        className={cn(
          TEXTAREA_CLASS,
          autoResize && "[field-sizing:content] min-h-[3lh] max-h-[12lh]",
          hasError &&
            "border-destructive focus-visible:ring-destructive focus-visible:border-destructive",
          className,
        )}
        ref={ref}
        aria-invalid={hasError || undefined}
        onBlur={handleBlur}
        onInput={handleInput}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
