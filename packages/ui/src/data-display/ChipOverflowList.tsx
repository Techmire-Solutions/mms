import * as React from "react";
import { Badge } from "../button/Badge";
import { Popover, PopoverContent, PopoverTrigger } from "../popover/Popover";
import { cn } from "../utils";

export interface ChipOverflowListProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  /** Chips shown inline before the "+N" trigger. */
  maxVisible?: number;
  /** Visible trigger text, e.g. `+5`. */
  moreLabel: (hiddenCount: number) => string;
  /** Accessible trigger name, e.g. `Show 5 more tags`. */
  moreAriaLabel: (hiddenCount: number) => string;
  className?: string;
}

/**
 * Compact chip list for dense cells: the first `maxVisible` chips inline, the rest behind a
 * "+N" popover trigger. Clicks inside never bubble to a clickable parent row.
 */
export function ChipOverflowList<T>({
  items,
  getKey,
  renderItem,
  maxVisible = 3,
  moreLabel,
  moreAriaLabel,
  className,
}: ChipOverflowListProps<T>): React.JSX.Element | null {
  if (items.length === 0) return null;

  const visible = items.slice(0, maxVisible);
  const hidden = items.slice(maxVisible);
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <ul className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {visible.map((item) => (
        <li key={getKey(item)} className="min-w-0 max-w-full">
          {renderItem(item)}
        </li>
      ))}
      {hidden.length > 0 ? (
        <li>
          <Popover>
            <PopoverTrigger asChild>
              <Badge
                as="button"
                tone="muted"
                variant="outline"
                size="sm"
                pill
                aria-label={moreAriaLabel(hidden.length)}
                onClick={stop}
                className="font-semibold focus-visible:ring-2 focus-visible:ring-ring"
              >
                {moreLabel(hidden.length)}
              </Badge>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              aria-label={moreAriaLabel(hidden.length)}
              className="w-auto max-w-xs p-2"
              onClick={stop}
            >
              <ul className="flex flex-wrap gap-1">
                {hidden.map((item) => (
                  <li key={getKey(item)}>{renderItem(item)}</li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </li>
      ) : null}
    </ul>
  );
}
