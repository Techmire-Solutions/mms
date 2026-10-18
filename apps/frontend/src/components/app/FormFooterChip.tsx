import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface FormFooterEntityChipProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

/**
 * Entity "name" chip in form footers (linked contact / session / teacher name).
 * Different job from soft tone pills — keep separate from Badge.
 */
export function FormFooterEntityChip({
  children,
  className,
  title,
}: FormFooterEntityChipProps): React.JSX.Element {
  return (
    <span
      title={title}
      className={cn(
        "font-bold text-foreground bg-muted/65 px-2.5 py-1 rounded-lg border border-border/60",
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface FormFooterErrorChipProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

/** Destructive required chip — Badge tone=destructive. */
export function FormFooterErrorChip({
  children,
  className,
  title,
}: FormFooterErrorChipProps): React.JSX.Element {
  return (
    <Badge
      as="span"
      tone="destructive"
      size="sm"
      role="status"
      title={title}
      className={cn("gap-1.5 px-2.5 py-1 font-bold", className)}
    >
      {children}
    </Badge>
  );
}
