import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/app/SectionLabel";
import { formatNumber } from "@mms/shared";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { resolveAccent, type AccentColor } from "@/components/app/statCardAccent";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { StatCardTrend } from "@/components/app/StatCardTrend";
import { StatCardSparkline } from "@/components/app/StatCardSparkline";

export interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string | null;
  icon?:
    LucideIcon | React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null;
  accent?: AccentColor;
  trend?: number;
  /** Contextual label for the trend period, e.g. "vs last month". */
  trendLabel?: string;
  /**
   * One-line narrative summary rendered below the value (P3-3).
   * E.g. "Dropped 12% vs last month, mainly Grade 3".
   * Label this as AI-generated at the call site if applicable.
   */
  narrativeText?: string;
  /**
   * Optional sparkline data — an array of numbers rendered as a 40px inline
   * line chart (P3-6). Gives instant trend visualisation without a click.
   * E.g. `[120, 132, 115, 148, 160, 155, 170]`
   */
  sparklineData?: number[];
  delayIndex?: number;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "compact";
  isActive?: boolean;
}

export const StatCard = function StatCard({
  label,
  value,
  sub = null,
  icon: Icon = null,
  accent,
  trend,
  trendLabel,
  narrativeText,
  sparklineData,
  delayIndex = 0,
  onClick,
  className,
  variant = "default",
  isActive = false,
}: StatCardProps): React.JSX.Element {
  const theme = resolveAccent(accent);
  const Comp = onClick ? motion.button : motion.div;
  const buttonProps = onClick ? { type: "button" as const, "aria-pressed": isActive } : {};
  const isCompact = variant === "compact";
  const formattedValue = typeof value === "number" ? formatNumber(value) : value;

  const reducedMotion = useReducedMotion();
  const motionProps =
    reducedMotion || isCompact
      ? { initial: false, animate: { opacity: 1, y: 0 } }
      : {
          initial: false,
          animate: { opacity: 1, y: 0 },
          transition: {
            delay: Math.min(delayIndex * 0.03, 0.1),
            duration: 0.2,
            ease: "easeOut" as const,
          },
        };

  if (isCompact) {
    return (
      <Comp
        {...buttonProps}
        {...motionProps}
        onClick={onClick}
        className={cn("w-full text-start", onClick && "cursor-pointer")}
      >
        <Card
          accentColor={accent}
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-3 min-h-11 w-full",
            CARD_STRIPE_INSET,
            onClick && "hover:border-primary/40 hover:bg-card/75",
            isActive && "ring-2 ring-primary/60 border-primary/60 bg-primary/5",
            className,
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 shadow-sm ring-4",
                  theme.iconBg,
                  theme.ring,
                )}
                aria-hidden="true"
              >
                <Icon className={cn("w-4 h-4", theme.iconText)} />
              </div>
            )}
            <div className="min-w-0">
              <SectionLabel as="p" weight="semibold" tracking="wide" className="truncate">
                {label}
              </SectionLabel>
              <p className="text-lg font-bold text-foreground leading-tight tabular-nums">
                {formattedValue}
              </p>
              {sub && (
                <p className="text-xs font-semibold text-muted-foreground mt-1 truncate">{sub}</p>
              )}
            </div>
          </div>
          {trend !== undefined && <StatCardTrend trend={trend} trendLabel={trendLabel} />}
          {sparklineData && <StatCardSparkline data={sparklineData} />}
        </Card>
      </Comp>
    );
  }

  return (
    <Comp
      {...buttonProps}
      {...motionProps}
      onClick={onClick}
      className={cn("w-full text-start", onClick && "cursor-pointer")}
    >
      <Card
        accentColor={accent}
        className={cn(
          "flex flex-col p-4 min-h-stat-compact w-full gap-2",
          CARD_STRIPE_INSET,
          onClick && "hover:border-primary/40 hover:bg-card/75",
          isActive && "ring-2 ring-primary/60 border-primary/60 bg-primary/5",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 w-full">
          <div className="flex items-center gap-3.5 min-w-0">
            {Icon && (
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 shadow-sm ring-4",
                  theme.iconBg,
                  theme.ring,
                )}
                aria-hidden="true"
              >
                <Icon className={cn("w-5 h-5", theme.iconText)} />
              </div>
            )}
            <div className="min-w-0">
              <SectionLabel as="p" className="block leading-none mb-1.5 truncate">
                {label}
              </SectionLabel>
              <p className="text-lg font-black text-foreground leading-none tracking-tight tabular-nums">
                {formattedValue}
              </p>
              {sub && (
                <p className="text-xs font-semibold text-muted-foreground mt-1 truncate">{sub}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {trend !== undefined && <StatCardTrend trend={trend} trendLabel={trendLabel} />}
            {sparklineData && <StatCardSparkline data={sparklineData} />}
          </div>
        </div>

        {narrativeText && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/30 pt-2 mt-1">
            {narrativeText}
          </p>
        )}
      </Card>
    </Comp>
  );
};
