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
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row flex-wrap items-stretch sm:items-center gap-2 pt-2",
        className,
      )}
    >
      {cancel ? (
        <Button
          type="button"
          variant="ghost"
          onClick={cancel.onClick}
          disabled={pending}
          className="w-full sm:w-auto min-h-11 cursor-pointer"
        >
          {cancel.label}
        </Button>
      ) : null}
      <Button
        type="submit"
        variant={variant === "secondary" ? "outline" : "default"}
        loading={pending}
        disabled={disabled}
        className="w-full sm:w-auto min-h-11 cursor-pointer"
      >
        {submitLabel}
      </Button>
    </div>
  );
}

FormSubmitActions.displayName = "FormSubmitActions";
