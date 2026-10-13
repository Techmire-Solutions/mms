import type { ReactNode } from "react";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { cn } from "@/lib/utils";

export interface DetailSectionTitleProps {
  children: ReactNode;
  className?: string;
  /** Optional count pill shown after the title (detail section headers). */
  count?: number;
}

/**
 * Lightweight detail-drawer / profile section heading.
 * SSOT for the `DETAIL_SECTION_TITLE` header markup (Contacts / Students / Teachers).
 */
export function DetailSectionTitle({
  children,
  className,
  count,
}: DetailSectionTitleProps): React.JSX.Element {
  if (count === undefined) {
    return (
      <SectionLabel as="h4" className={cn("ps-1", className)}>
        {children}
      </SectionLabel>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <SectionLabel as="h4" className="ps-1">
        {children}
      </SectionLabel>
      <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted/60">
        {count}
      </span>
    </div>
  );
}
