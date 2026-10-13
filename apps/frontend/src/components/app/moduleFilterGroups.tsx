import type { ReactNode } from "react";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ModuleFilterCheckboxOption {
  value: string;
  label: string;
}

export interface ModuleFilterCheckboxGroupProps {
  label: string;
  options: ModuleFilterCheckboxOption[];
  selected: string[];
  onToggle: (value: string) => void;
}

/** Labeled multi-select checkbox group for a filter dropdown. */
export function ModuleFilterCheckboxGroup({
  label,
  options,
  selected,
  onToggle,
}: ModuleFilterCheckboxGroupProps): React.JSX.Element {
  const selectedSet = new Set(selected);
  return (
    <>
      <DropdownMenuLabel className="text-xs text-foreground">{label}</DropdownMenuLabel>
      {options.map((option) => (
        <DropdownMenuCheckboxItem
          key={option.value}
          checked={selectedSet.has(option.value)}
          onCheckedChange={() => onToggle(option.value)}
        >
          {option.label}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  );
}

export interface ModuleFilterRadioOption {
  value: string;
  label: ReactNode;
}

export interface ModuleFilterRadioGroupProps {
  label: string;
  options: ModuleFilterRadioOption[];
  value: string;
  onValueChange: (value: string) => void;
}

/** Labeled single-select radio group for a filter dropdown. */
export function ModuleFilterRadioGroup({
  label,
  options,
  value,
  onValueChange,
}: ModuleFilterRadioGroupProps): React.JSX.Element {
  return (
    <>
      <DropdownMenuLabel className="text-xs text-foreground">{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
        {options.map((option) => (
          <DropdownMenuRadioItem key={option.value} value={option.value} className="text-sm">
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

export interface ModuleFilterDividerProps {
  className?: string;
}

/** Vertical divider between groups within a filter dropdown. */
export function ModuleFilterDivider({ className }: ModuleFilterDividerProps): React.JSX.Element {
  return <DropdownMenuSeparator className={cn("bg-border", className)} />;
}
