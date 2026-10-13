/**
 * @file DetailNotesBlock.tsx
 * @description Shared detail-drawer notes body (title once — no duplicate inner heading).
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { FileText } from "lucide-react";
import { DetailSectionTitle } from "@/components/ui/DetailSectionTitle";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

export interface DetailNotesBlockProps {
  title: ReactNode;
  notes: string;
  icon?: LucideIcon;
  className?: string;
}

export function DetailNotesBlock({
  title,
  notes,
  icon: Icon = FileText,
  className,
}: DetailNotesBlockProps): React.JSX.Element {
  return (
    <div className={cn("space-y-2", className)}>
      <DetailSectionTitle>{title}</DetailSectionTitle>
      <div className={cn("flex gap-2 p-3.5 border-border/60 text-xs", WORK_SURFACE_INNER)}>
        <Icon className="size-3.5 text-primary shrink-0 mt-0.5" aria-hidden />
        <p className="min-w-0 whitespace-pre-wrap leading-relaxed text-muted-foreground">{notes}</p>
      </div>
    </div>
  );
}
