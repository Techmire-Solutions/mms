import React from "react";
import { AnimatePresence } from "framer-motion";
import { WidgetBuilder } from "@/lib/reports/pinnedWidgets";
import { CustomWidgetRenderer } from "@/tenant/components/reports";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveDefaultDashboardWidgetScope } from "@/lib/dashboardRole";
import { CustomizeItemRow } from "@/tenant/features/dashboard/components/CustomizeItemRow";
import { DashboardCustomizeWidgetsSection } from "@/tenant/features/dashboard/components/DashboardCustomizeWidgetsSection";
import { DashboardAlertThresholdsSection } from "@/tenant/features/dashboard/components/DashboardAlertThresholdsSection";
import { SectionCard } from "@/components/app/SectionCard";
import { Button } from "@/components/ui/button";
import type { DashboardCustomizePanelProps } from "@/tenant/features/dashboard/lib/dashboardCustomizePanelTypes";

export type { DashboardCustomizePanelProps };

/**
 * Dashboard customize mode: metric card visibility + pinned widget management + alert thresholds + layout density.
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
  gridMode = "comfortable",
  onUpdateThreshold,
  onUpdateGridMode,
  onCloseBuilder,
  onSaveWidget,
  onEditWidget,
  onDeleteWidget,
  onToggleWidgetPin,
  onOpenWidgetBuilder,
  onReorderWidgets,
}: DashboardCustomizePanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const widgetScope = resolveDefaultDashboardWidgetScope(can);
  const disabledSet = new Set(disabledCardIds);
  const metricTitle = t("dashboard.metricCardsSettings");
  const densityTitle = t("dashboard.layoutDensity");

  return (
    <div className="space-y-5 pb-1">
      <AnimatePresence>
        {isWidgetBuilderOpen && (
          <div className="mb-5">
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

        {onUpdateGridMode && (
          <SectionCard
            title={densityTitle}
            subtitle={t("dashboard.layoutDensityDesc")}
            padding="p-6"
            accentColor="primary"
          >
            <fieldset className="space-y-4 border-0 p-0 m-0 min-w-0">
              <legend className="sr-only">{densityTitle}</legend>
              <div className="space-y-2 max-h-preview-tall overflow-y-auto pe-1">
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant={gridMode === "comfortable" ? "default" : "outline"}
                    size="sm"
                    onClick={() => onUpdateGridMode("comfortable")}
                    className="flex-1 cursor-pointer font-bold"
                  >
                    {t("dashboard.densityComfortable")}
                  </Button>
                  <Button
                    type="button"
                    variant={gridMode === "compact" ? "default" : "outline"}
                    size="sm"
                    onClick={() => onUpdateGridMode("compact")}
                    className="flex-1 cursor-pointer font-bold"
                  >
                    {t("dashboard.densityCompact")}
                  </Button>
                </div>
              </div>
            </fieldset>
          </SectionCard>
        )}

        {onUpdateThreshold && (
          <DashboardAlertThresholdsSection
            lowAttendanceThreshold={lowAttendanceThreshold}
            urgentAttendanceThreshold={urgentAttendanceThreshold}
            onUpdateThreshold={onUpdateThreshold}
            hasGridMode={Boolean(onUpdateGridMode)}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

export default DashboardCustomizePanel;
