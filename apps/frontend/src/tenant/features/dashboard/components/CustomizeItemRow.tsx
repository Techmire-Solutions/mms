import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

export interface CustomizeItemRowProps {
  id: string;
  checked: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function CustomizeItemRow({
  id,
  checked,
  onToggle,
  title,
  subtitle,
  actions,
}: CustomizeItemRowProps): React.JSX.Element {
  return (
    <div
      className="flex min-h-11 items-center justify-between gap-3 p-2.5 rounded-xl border border-border/50 bg-card/10 hover:bg-card/45 hover:border-primary/20 transition-all select-none cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={onToggle}
          onClick={(event) => event.stopPropagation()}
        />
        <label
          htmlFor={id}
          className="min-w-0 flex-1 cursor-pointer select-none space-y-0.5 truncate text-start"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-xs font-bold text-foreground leading-tight truncate">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider capitalize truncate">
              {subtitle}
            </p>
          )}
        </label>
      </div>

      {actions && (
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
