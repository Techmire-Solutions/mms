import * as React from "react";
import { type Dropdown } from "react-day-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CalendarDropdownProps = React.ComponentProps<typeof Dropdown>;

/**
 * Month/year caption control for DayPicker — Radix Select (not native select)
 * so menus work inside Popover/Dialog without OS paint-order or dismiss bugs.
 */
export function CalendarDropdown({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
  disabled,
}: CalendarDropdownProps): React.JSX.Element {
  const handleValueChange = (next: string) => {
    if (!onChange) return;
    onChange({
      target: { value: next },
    } as React.ChangeEvent<HTMLSelectElement>);
  };

  const stringValue = value == null ? undefined : String(value);

  const isMonths = options && options.length === 12;
  const resolvedAriaLabel = ariaLabel || (isMonths ? "Select month" : "Select year");

  return (
    <Select value={stringValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger
        aria-label={resolvedAriaLabel}
        className={cn(
          "relative h-8 min-h-8 w-auto gap-1 border border-border/60 bg-muted/40 hover:bg-muted/80 px-2.5 py-1 text-xs font-semibold rounded-lg shadow-none focus:ring-1 focus:ring-primary/40 [&>span]:line-clamp-none transition-all cursor-pointer after:absolute after:start-1/2 after:top-1/2 after:h-11 after:min-w-11 after:w-full after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] [&>svg]:transition-transform [&>svg]:duration-200 data-[state=open]:[&>svg]:rotate-180",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-56 rounded-xl surface-overlay p-1" position="popper">
        {options?.map((option) => (
          <SelectItem
            key={option.value}
            value={String(option.value)}
            disabled={option.disabled}
            className="text-xs cursor-pointer rounded-md data-[state=checked]:font-bold data-[state=checked]:text-primary data-[state=checked]:bg-primary/10 transition-colors"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
