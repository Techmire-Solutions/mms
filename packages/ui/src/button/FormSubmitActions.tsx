import React from "react";
import { Button } from "./Button";
import { cn } from "../utils";

export interface FormSubmitActionsProps {
  submitLabel: string;
  pending: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  cancel?: { label: string; onClick: () => void };
  className?: string;
}

export function FormSubmitActions({
  submitLabel,
  pending,
  disabled = false,
  variant = "primary",
  cancel,
  className,
}: FormSubmitActionsProps): React.JSX.Element {
  return (
    <div className={cn("flex flex-wrap gap-2 pt-2", className)}>
      <Button
        type="submit"
        variant={variant === "secondary" ? "outline" : "default"}
        loading={pending}
        disabled={disabled}
        className="w-full sm:w-auto min-h-11"
      >
        {submitLabel}
      </Button>
      {cancel ? (
        <Button
          type="button"
          variant="ghost"
          onClick={cancel.onClick}
          disabled={pending}
          className="w-full sm:w-auto min-h-11"
        >
          {cancel.label}
        </Button>
      ) : null}
    </div>
  );
}

FormSubmitActions.displayName = "FormSubmitActions";
