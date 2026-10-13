import React, { useId, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDropdownListbox } from "@/components/app/useDropdownListbox";
import { cn } from "@/lib/utils";

export interface DropdownSelectBaseProps<T = string> {
  options: readonly T[];
  value?: T | readonly T[];
  onSelect?: (option: T) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderTrigger: (api: {
    open: boolean;
    listboxId: string;
    triggerProps: {
      id?: string;
      "aria-haspopup": "listbox";
      "aria-expanded": boolean;
      "aria-controls": string;
    };
  }) => ReactNode;
  header?: ReactNode | ((api: { setHighlightedIndex: (index: number) => void }) => ReactNode);
  footer?: ReactNode | ((api: { close: () => void }) => ReactNode);
  children: (api: {
    highlightedIndex: number;
    setHighlightedIndex: (index: number) => void;
    select: (option: T) => void;
    listboxId: string;
  }) => ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}

/**
 * Reusable headless base component for listbox dropdowns and selects,
 * managing popover positioning, keyboard traversal, and tokenized BiDi styling.
 */
export function DropdownSelectBase<T = string>({
  options,
  value,
  onSelect,
  open: controlledOpen,
  onOpenChange,
  renderTrigger,
  header,
  footer,
  children,
  contentClassName,
  id,
}: DropdownSelectBaseProps<T>): React.JSX.Element {
  const fallbackId = useId();
  const resolvedId = id || fallbackId;
  const listboxId = `${resolvedId}-listbox`;

  const { open, setOpen, highlightedIndex, setHighlightedIndex, handleKeyDown } =
    useDropdownListbox({
      options,
      value,
      onSelect,
      isOpen: controlledOpen,
      onOpenChange,
    });

  const select = (option: T) => {
    onSelect?.(option);
    setOpen(false);
  };

  const triggerProps = {
    id: resolvedId,
    "aria-haspopup": "listbox" as const,
    "aria-expanded": open,
    "aria-controls": listboxId,
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{renderTrigger({ open, listboxId, triggerProps })}</PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          "p-0 w-[var(--radix-popover-trigger-width)] min-w-popover-lg max-h-[var(--radix-popover-content-available-height)] flex flex-col overflow-hidden rounded-xl surface-overlay divide-y divide-border/60",
          contentClassName,
        )}
        onKeyDown={handleKeyDown}
      >
        {typeof header === "function" ? header({ setHighlightedIndex }) : header}
        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
        >
          {children({
            highlightedIndex,
            setHighlightedIndex,
            select,
            listboxId,
          })}
        </div>
        {typeof footer === "function" ? footer({ close: () => setOpen(false) }) : footer}
      </PopoverContent>
    </Popover>
  );
}
