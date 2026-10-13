import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { DetailSectionTitle } from "@/components/ui/DetailSectionTitle";
import type { CardAccentColor } from "@/lib/semanticTone";

export interface DetailSectionCardProps {
  title: string;
  children: ReactNode;
  accentColor?: CardAccentColor;
  className?: string;
  /** Optional count pill shown after the title. */
  count?: number;
}

/**
 * Shared detail-drawer section chrome: section title + accent Card.
 * SSOT for Contacts (and similar) profile detail sections.
 */
export function DetailSectionCard({
  title,
  children,
  accentColor,
  className,
  count,
}: DetailSectionCardProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <DetailSectionTitle count={count}>{title}</DetailSectionTitle>
      <Card accentColor={accentColor} className={className}>
        {children}
      </Card>
    </div>
  );
}
