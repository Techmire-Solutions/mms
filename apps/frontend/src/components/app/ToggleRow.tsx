import * as React from "react";
import { Switch } from "@/components/ui/switch";

export interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (newValue: boolean) => void;
  ariaLabel?: string;
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
  ariaLabel,
}: ToggleRowProps): React.JSX.Element {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-start">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} aria-label={ariaLabel || label} />
    </div>
  );
}
