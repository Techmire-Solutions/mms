import React from "react";
import { motion } from "framer-motion";
import { Trash2, Plus, Pencil } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { StatCardBody } from "@/components/ui/StatCardBody";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { resolveCardVisuals } from "@/lib/dashboardWidgetColors";
import { WidgetCard } from "@/components/ui/WidgetCard";
import type { StatItem } from "@/lib/dashboardWidgets";

import { EmptyState } from "@/components/ui/EmptyState";
import { LayoutGrid } from "lucide-react";

const MotionWidgetCard = motion.create(WidgetCard);

export interface StatisticsGridProps {
  statItems: StatItem[];
  customCardIds?: string[];
  onDeleteCustomCard?: (id: string) => void;
  onEditCustomCard?: (id: string) => void;
  isEditMode?: boolean;
  onAddCardClick?: () => void;
  isLoading?: boolean;
  onResetCards?: () => void;
}

export type StatsGridProps = StatisticsGridProps;

export function StatisticsGrid({
  statItems,
  customCardIds = [],
  onDeleteCustomCard,
  onEditCustomCard,
  isEditMode = false,
  onAddCardClick,
  isLoading = false,
  onResetCards,
}: StatisticsGridProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const customCardSet = (() => new Set(customCardIds))();

  if (isLoading) {
    return (
      <section
        aria-label={t("dashboard.statsSectionLabel")}
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 font-sans"
      >
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={`stat-skeleton-${idx}`}
            className="rounded-2xl border border-border/40 bg-card/20 p-5 min-h-32 flex flex-col justify-between animate-pulse select-none"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-muted/60" />
              <div className="w-12 h-5 rounded-md bg-muted/40" />
            </div>
            <div className="space-y-2 mt-4">
              <div className="w-20 h-6 rounded bg-muted/60" />
              <div className="w-32 h-3 rounded bg-muted/40" />
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (!isLoading && statItems.length === 0 && !isEditMode) {
    return (
      <div className="py-2">
        <EmptyState
          icon={LayoutGrid}
          title={t("dashboard.noCardsVisibleTitle")}
          description={t("dashboard.noCardsVisibleDesc")}
          action={
            onResetCards ? (
              <Button variant="outline" size="sm" onClick={onResetCards} className="mt-2 text-xs">
                {t("dashboard.resetCards")}
              </Button>
            ) : undefined
          }
          compact
        />
      </div>
    );
  }

  return (
    <section
      aria-label={t("dashboard.statsSectionLabel")}
      className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 font-sans"
    >
      {statItems.map((statItem, statIndex) => {
        const { IconComponent: Icon, colorTheme, accent } = resolveCardVisuals(statItem);
        const hasPositiveTrend = statItem.trend >= 0;
        const isCustomCard = customCardSet.has(statItem.id);

        const motionProps = reducedMotion
          ? { initial: false, animate: { opacity: 1, y: 0 } }
          : {
              initial: { opacity: 0, y: 16 },
              animate: { opacity: 1, y: 0 },
              transition: { delay: statIndex * 0.05, duration: 0.35, ease: "easeOut" as const },
            };

        return (
          <MotionWidgetCard
            key={statItem.id}
            {...motionProps}
            accentColor={accent}
            className="p-4.5 md:p-5 px-5.5 flex flex-col justify-between"
          >
            <StatCardBody
              colorTheme={colorTheme}
              icon={<Icon className={`w-4.5 h-4.5 ${colorTheme.text}`} />}
              value={statItem.value}
              title={statItem.title}
              footer={statItem.sub}
              trend={isEditMode ? undefined : statItem.trend}
              trendAriaLabel={
                statItem.trend !== 0 && !isEditMode
                  ? t("dashboard.trendAria", {
                      direction: hasPositiveTrend
                        ? t("dashboard.trendUp")
                        : t("dashboard.trendDown"),
                      value: Math.abs(statItem.trend),
                    })
                  : undefined
              }
              actions={
                isEditMode ? (
                  <div className="flex items-center gap-1">
                    {onEditCustomCard && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCustomCard(statItem.id);
                        }}
                        className="rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all cursor-pointer border border-transparent hover:border-primary/10"
                        title={t("dashboard.editCardConfig")}
                        aria-label={t("dashboard.editCardConfig")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isCustomCard && onDeleteCustomCard && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustomCard(statItem.id);
                        }}
                        className="rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer border border-transparent hover:border-destructive/10"
                        title={t("dashboard.deleteCard")}
                        aria-label={t("dashboard.deleteCard")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ) : undefined
              }
            />
          </MotionWidgetCard>
        );
      })}

      {isEditMode && onAddCardClick && (
        <Button
          variant="outline"
          onClick={onAddCardClick}
          className="border border-dashed border-border rounded-xl p-4 md:p-5 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-300 group text-muted-foreground min-h-stat-card h-auto"
        >
          <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-xs font-bold group-hover:text-primary transition-colors">
            {t("dashboard.addMetricCard")}
          </span>
        </Button>
      )}
    </section>
  );
}

export default StatisticsGrid;
