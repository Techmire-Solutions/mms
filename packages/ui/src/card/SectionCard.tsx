import React from "react";
import { cn } from "../utils";
import { Card, type CardAccentColor, CARD_STRIPE_INSET } from "./Card";
import { CardTitleBar } from "./CardTitleBar";

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

const ACCENT_ICON_STYLES: Record<string, { iconBg: string; iconText: string }> = {
  primary: { iconBg: "bg-primary/10", iconText: "text-primary" },
  success: { iconBg: "bg-success/10", iconText: "text-success" },
  warning: { iconBg: "bg-warning/10", iconText: "text-warning" },
  destructive: { iconBg: "bg-destructive/10", iconText: "text-destructive" },
  info: { iconBg: "bg-info/10", iconText: "text-info" },
  secondary: { iconBg: "bg-secondary/10", iconText: "text-secondary" },
  muted: { iconBg: "bg-muted", iconText: "text-muted-foreground" },
};

function resolveAccentStyles(color?: string) {
  if (!color || color === "none") return ACCENT_ICON_STYLES.primary;
  return ACCENT_ICON_STYLES[color] ?? ACCENT_ICON_STYLES.primary;
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
  const accentConfig = resolveAccentStyles(hasStripe ? (accentColor as string) : undefined);
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
