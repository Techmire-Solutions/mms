import type React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PermCellProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

export function PermCell({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: PermCellProps): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`mx-auto flex min-h-11 min-w-11 items-center justify-center rounded-lg border-2 transition-all p-0 shadow-none hover:bg-transparent ${
        checked
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          : "border-border bg-card text-transparent hover:border-primary/50"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <Check className="h-3.5 w-3.5" />
    </Button>
  );
}
