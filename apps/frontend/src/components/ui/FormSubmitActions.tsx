import { Button } from "@/components/ui/button";

interface FormSubmitActionsProps {
  submitLabel: string;
  pending: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  cancel?: { label: string; onClick: () => void };
}

export function FormSubmitActions({
  submitLabel,
  pending,
  disabled = false,
  variant = "primary",
  cancel,
}: FormSubmitActionsProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <Button
        type="submit"
        variant={variant === "secondary" ? "outline" : "primary"}
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
