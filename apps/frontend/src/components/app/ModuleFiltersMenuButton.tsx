import React, { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { RotateCcw, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  WORK_TOOLBAR_TRIGGER,
  WORK_TOOLBAR_TRIGGER_FILTER_ACTIVE,
  WORK_TOOLBAR_TRIGGER_FILTER_IDLE,
} from "@/components/ui/formStyles";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export {
  ModuleFilterCheckboxGroup,
  ModuleFilterRadioGroup,
  ModuleFilterDivider,
  type ModuleFilterCheckboxOption,
  type ModuleFilterCheckboxGroupProps,
  type ModuleFilterRadioOption,
  type ModuleFilterRadioGroupProps,
  type ModuleFilterDividerProps,
} from "@/components/app/moduleFilterGroups";

export interface ModuleFiltersMenuTriggerProps extends ComponentPropsWithoutRef<"button"> {
  label: string;
  activeCount?: number;
  icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Shared Filters menu trigger (badge + active styles). Use as DropdownMenuTrigger child via asChild.
 */
export function ModuleFiltersMenuTrigger({
  label,
  activeCount = 0,
  icon: Icon = SlidersHorizontal,
  className,
  children,
  type = "button",
  ref,
  ...rest
}: ModuleFiltersMenuTriggerProps): React.JSX.Element {
  const isActive = activeCount > 0;

  return (
    <Button
      ref={ref}
      type={type}
      variant="ghost"
      className={cn(
        WORK_TOOLBAR_TRIGGER,
        isActive ? WORK_TOOLBAR_TRIGGER_FILTER_ACTIVE : WORK_TOOLBAR_TRIGGER_FILTER_IDLE,
        className,
      )}
      {...rest}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{label}</span>
      {isActive ? (
        <Badge className="min-w-4 h-4 px-1 text-2xs font-bold inline-flex items-center justify-center">
          {activeCount}
        </Badge>
      ) : null}
      {children}
    </Button>
  );
}

export interface ModuleFilterDropdownProps {
  /** Localized label shown on the trigger button. */
  label: string;
  /** Number of active filters; renders the count badge + active styling. */
  activeCount: number;
  icon?: LucideIcon;
  /** Localized clear-all label. When set and activeCount > 0, renders a clear-all item. */
  clearLabel?: string;
  onClear?: () => void;
  /** Labeled dropdown body groups (checkbox / radio) composed by callers. */
  children: ReactNode;
  contentClassName?: string;
}

/**
 * Shared filter-dropdown shell: consistent trigger + content chrome for module Work
 * filter menus (Contacts / Students / Teachers / Messaging). Compose checkbox/radio
 * groups via {@link ModuleFilterCheckboxGroup} / {@link ModuleFilterRadioGroup}.
 */
export function ModuleFilterDropdown({
  label,
  activeCount,
  icon,
  clearLabel,
  onClear,
  children,
  contentClassName,
}: ModuleFilterDropdownProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ModuleFiltersMenuTrigger label={label} activeCount={activeCount} icon={icon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "w-56 max-h-dialog-scroll overflow-y-auto bg-card border border-border",
          contentClassName,
        )}
      >
        {activeCount > 0 && clearLabel && onClear ? (
          <>
            <DropdownMenuItem
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-between"
            >
              <span>{clearLabel}</span>
              <RotateCcw className="w-3 h-3 ms-1" />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
          </>
        ) : null}
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
