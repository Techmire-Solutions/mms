import React, { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { WidgetBuilder } from "@/components/reports/pinnedWidgets/WidgetBuilder";
import { CustomWidgetRenderer } from "@/tenant/components/reports/pinnedWidgetsFacade";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { resolveDefaultDashboardWidgetScope } from "@/lib/dashboardRole";
import { CustomizeItemRow } from "@/tenant/features/dashboard/components/CustomizeItemRow";
import { DashboardCustomizeWidgetsSection } from "@/tenant/features/dashboard/components/DashboardCustomizeWidgetsSection";
import { DashboardAlertThresholdsSection } from "@/tenant/features/dashboard/components/DashboardAlertThresholdsSection";
import { SectionCard } from "@/components/app/SectionCard";
import { Button } from "@/components/ui/button";
import type { DashboardCustomizePanelProps } from "@/tenant/features/dashboard/lib/dashboardCustomizePanelTypes";

export type { DashboardCustomizePanelProps };

/**
 * Dashboard customize mode: metric card visibility + pinned widget management +
 * alert thresholds.
 *
 * Layout density lives in the pinned-panels header, next to the panels it
 * actually changes — this panel used to duplicate that control with copy that
 * promised dashboard-wide density (2026-11-04 UI review).
 */
export function DashboardCustomizePanel({
  can,
  customWidgets,
  disabledCardIds,
  toggleCardVisibility,
  dashboardMetricCards,
  selectedDashboardCardCount,
  pinnedDashboardWidgetCount,
  isWidgetBuilderOpen,
  editingWidget,
  widgetBuilderType,
  lowAttendanceThreshold,
  urgentAttendanceThreshold,
  onUpdateThreshold,
  onCloseBuilder,
  onSaveWidget,
  onEditWidget,
  onDeleteWidget,
  onToggleWidgetPin,
  onOpenWidgetBuilder,
  onReorderWidgets,
  onDone,
}: DashboardCustomizePanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const widgetScope = resolveDefaultDashboardWidgetScope(can);
  const disabledSet = new Set(disabledCardIds);
  const metricTitle = t("dashboard.metricCardsSettings");
  const builderRef = useRef<HTMLDivElement | null>(null);

  // Reveal the builder instead of yanking the document to the top: the builder
  // renders inside this panel, below the greeting (2026-11-04 UI review).
  useEffect(() => {
    if (!isWidgetBuilderOpen) return;
    const node = builderRef.current;
    if (!node) return;
    node.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth",
    });
    node.focus({ preventScroll: true });
  }, [isWidgetBuilderOpen, reducedMotion]);

  return (
    <div
      id="dashboard-customize-panel"
      role="region"
      aria-label={t("dashboard.customizeCards")}
      className="space-y-5 pb-1 print:hidden"
    >
      <AnimatePresence>
        {isWidgetBuilderOpen && (
          <div ref={builderRef} tabIndex={-1} className="mb-5 scroll-mt-24 outline-none">
            <WidgetBuilder
              initialCollection={widgetScope.collection}
              editWidgetConfig={editingWidget}
              onCancelEdit={onCloseBuilder}
              onSaveWidget={onSaveWidget}
              category={widgetScope.category}
              mode="dashboard"
              initialWidgetType={widgetBuilderType}
              renderWidget={(widget, isCompact) => (
                <CustomWidgetRenderer
                  widget={widget}
                  collections={{} as Parameters<typeof CustomWidgetRenderer>[0]["collections"]}
                  isCompact={isCompact}
                  onSwitchToggle={() => {}}
                  onMetricClick={() => {}}
                />
              )}
            />
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-start">
        <SectionCard
          title={metricTitle}
          subtitle={t("dashboard.metricCardsSettingsDesc")}
          padding="p-6"
          accentColor="primary"
        >
          <fieldset className="space-y-4 border-0 p-0 m-0 min-w-0">
            <legend className="sr-only">{metricTitle}</legend>
            <div className="text-xs border-b border-border/45 pb-3">
              <p className="font-bold text-foreground">
                {t("dashboard.selectedCards", { count: selectedDashboardCardCount })}
              </p>
            </div>
            <div className="space-y-2 max-h-preview-tall overflow-y-auto pe-1">
              {dashboardMetricCards.map((dashboardCard) => (
                <CustomizeItemRow
                  key={dashboardCard.id}
                  id={`card-vis-${dashboardCard.id}`}
                  checked={!disabledSet.has(dashboardCard.id)}
                  onToggle={() => toggleCardVisibility(dashboardCard.id)}
                  title={dashboardCard.title}
                />
              ))}
            </div>
          </fieldset>
        </SectionCard>

        <DashboardCustomizeWidgetsSection
          customWidgets={customWidgets.filter((widget) => widget.widgetType !== "card")}
          pinnedDashboardWidgetCount={pinnedDashboardWidgetCount}
          onEditWidget={onEditWidget}
          onDeleteWidget={onDeleteWidget}
          onToggleWidgetPin={onToggleWidgetPin}
          onOpenWidgetBuilder={onOpenWidgetBuilder}
          onReorderWidgets={onReorderWidgets}
        />

        {onUpdateThreshold && (
          <DashboardAlertThresholdsSection
            lowAttendanceThreshold={lowAttendanceThreshold}
            urgentAttendanceThreshold={urgentAttendanceThreshold}
            onUpdateThreshold={onUpdateThreshold}
            t={t}
          />
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          className="min-h-11 cursor-pointer"
        >
          {t("dashboard.exitCustomization")}
        </Button>
      </div>
    </div>
  );
}

export default DashboardCustomizePanel;
