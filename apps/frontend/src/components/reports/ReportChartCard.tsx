import React from "react";
import { Card } from "@/components/ui/card";
import { SafeResponsiveContainer } from "@/components/app/SafeResponsiveContainer";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";

export interface ReportChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  heightClass?: string;
  accentColor?:
    "primary" | "secondary" | "success" | "warning" | "destructive" | "info" | "neutral";
  className?: string;
  children: React.ReactNode;
  empty?: boolean;
  emptyNode?: React.ReactNode;
  "aria-label"?: string;
}

/**
 * Standardized chart card wrapper for all module report views.
 * Ensures zero-CLS ResponsiveContainer initialization, theme stripe inset, and consistent typography.
 */
export const ReportChartCard = function ReportChartCard({
  title,
  subtitle,
  action,
  actions,
  heightClass = "h-chart-md",
  accentColor,
  className,
  children,
  empty = false,
  emptyNode,
  "aria-label": ariaLabel,
}: ReportChartCardProps): React.JSX.Element {
  const headerAction = action ?? actions;

  return (
    <Card
      accentColor={accentColor}
      className={cn("p-4 space-y-3", CARD_STRIPE_INSET, className)}
      aria-label={ariaLabel || title}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {empty && emptyNode ? (
        <div className={cn("flex items-center justify-center", heightClass)}>{emptyNode}</div>
      ) : (
        <div className={cn("w-full", heightClass)} inert>
          <SafeResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 1, height: 1 }}
          >
            {children}
          </SafeResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

export default ReportChartCard;
