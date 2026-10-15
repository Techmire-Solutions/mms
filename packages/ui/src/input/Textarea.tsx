import * as React from "react";
import { cn } from "../utils";

export const TEXTAREA_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 min-h-20 resize-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation transition-colors";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string;
  ref?: React.Ref<HTMLTextAreaElement>;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, id, name, error, ...props }, ref) => {
    const fallbackId = React.useId();
    const resolvedId = id || fallbackId;
    const resolvedName = name || fallbackId;
    const hasError = Boolean(error);

    return (
      <textarea
        id={resolvedId}
        name={resolvedName}
        className={cn(
          TEXTAREA_CLASS,
          hasError &&
            "border-destructive focus-visible:ring-destructive focus-visible:border-destructive",
          className,
        )}
        ref={ref}
        aria-invalid={hasError || undefined}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
