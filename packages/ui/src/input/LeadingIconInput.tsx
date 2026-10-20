import type { LucideIcon } from "lucide-react";
import React from "react";
import { Input } from "./Input";
import { cn } from "../utils";

export interface LeadingIconInputProps extends React.ComponentPropsWithoutRef<typeof Input> {
  /** Icon rendered at the start of the input. */
  icon: LucideIcon;
  /** Padding override for the leading icon (default: `ps-10`). */
  iconPaddingClass?: string;
  /** Extra classes for the wrapping relative flex container. */
  wrapperClassName?: string;
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Input with a leading icon and focus-tinted icon color.
 * SSOT for the `group/input` + absolute leading icon + `ps-*` Input pattern.
 */
export function LeadingIconInput({
  icon: Icon,
  iconPaddingClass = "ps-10",
  wrapperClassName,
  className,
  ref,
  ...rest
}: LeadingIconInputProps) {
  return (
    <div className={cn("relative flex items-center group/input", wrapperClassName)}>
      <Icon
        className="pointer-events-none absolute start-3.5 h-4 w-4 text-muted-foreground/60 transition-colors group-focus-within/input:text-primary"
        aria-hidden="true"
      />
      <Input ref={ref} className={cn(iconPaddingClass, className)} {...rest} />
    </div>
  );
}
