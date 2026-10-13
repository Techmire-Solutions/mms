import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CardTitleBar } from "@/components/app/CardTitleBar";
import { CARD_STRIPE_INSET, type CardAccentColor } from "@/lib/ui/semanticTone";
import { resolveAccent } from "@/components/app/statCardAccent";

export interface SectionCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  padding?: boolean | string;
  className?: string;
  children: React.ReactNode;
  accentColor?: CardAccentColor | "none" | false | null;
  headingLevel?: 2 | 3;
  headingId?: string;
  ref?: React.Ref<HTMLDivElement>;
}

/** Section card — semantic tokens + `cn()` for class merging. */
export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  actions,
  padding = true,
  className,
  children,
  accentColor = "primary",
  headingLevel = 3,
  headingId,
  ref,
}: SectionCardProps): React.JSX.Element {
  const hasHeader = Boolean(title || Icon || actions);
  const hasStripe = Boolean(accentColor && accentColor !== "none");
  const accentConfig = resolveAccent(hasStripe ? (accentColor as CardAccentColor) : undefined);
  const paddingClass = typeof padding === "string" ? padding : padding ? "px-5 py-4" : undefined;

  return (
    <Card ref={ref} className={className} accentColor={accentColor}>
      {hasHeader && (
        <CardTitleBar
          title={title}
          subtitle={subtitle}
          actions={actions}
          headingLevel={headingLevel}
          headingId={headingId}
          inset={hasStripe}
          className="rounded-t-2xl"
          icon={
            Icon && (
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
                  accentConfig.iconBg,
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", accentConfig.iconText)} />
              </div>
            )
          }
        />
      )}
      <div className={cn(paddingClass, hasStripe && CARD_STRIPE_INSET)}>{children}</div>
    </Card>
  );
}
SectionCard.displayName = "SectionCard";
