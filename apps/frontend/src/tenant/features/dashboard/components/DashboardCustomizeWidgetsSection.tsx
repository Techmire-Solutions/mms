import React from "react";
import { Pencil, Trash2, Plus, ChevronUp, ChevronDown } from "lucide-react";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { getCollectionLabel } from "@/lib/reports/reportMetadata";
import { useTranslation } from "@/hooks/useTranslation";
import { isSeededDashboardWidget, resolveWidgetTitle } from "@/lib/dashboardWidgets";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionCard } from "@/components/app/SectionCard";
import { CustomizeItemRow } from "@/tenant/features/dashboard/components/CustomizeItemRow";

export interface DashboardCustomizeWidgetsSectionProps {
  customWidgets: CustomWidget[];
  pinnedDashboardWidgetCount: number;
  onEditWidget: (widget: CustomWidget) => void;
  onDeleteWidget: (widgetId: string) => void;
  onToggleWidgetPin: (widgetId: string) => void;
  onOpenWidgetBuilder: (type: CustomWidget["widgetType"], widget?: CustomWidget | null) => void;
  onReorderWidgets?: (reorderedWidgets: CustomWidget[]) => void;
}

export function DashboardCustomizeWidgetsSection({
  customWidgets,
  pinnedDashboardWidgetCount,
  onEditWidget,
  onDeleteWidget,
  onToggleWidgetPin,
  onOpenWidgetBuilder,
  onReorderWidgets,
}: DashboardCustomizeWidgetsSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const title = t("dashboard.chartsWidgetsSettings");

  const handleMove = (index: number, direction: "up" | "down") => {
    if (!onReorderWidgets) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= customWidgets.length) return;

    const nextWidgets = [...customWidgets];
    const [removed] = nextWidgets.splice(index, 1);
    nextWidgets.splice(targetIndex, 0, removed);

    const reordered = nextWidgets.map((w, idx) => ({ ...w, sortOrder: idx }));
    onReorderWidgets(reordered);
  };

  return (
    <SectionCard
      title={title}
      subtitle={t("dashboard.chartsWidgetsSettingsDesc")}
      padding="p-6"
      accentColor="primary"
    >
      <fieldset className="space-y-4 border-0 p-0 m-0 min-w-0">
        <legend className="sr-only">{title}</legend>
        <div className="text-xs border-b border-border/45 pb-3">
          <div className="space-y-0.5">
            <p className="font-bold text-foreground">
              {t("dashboard.pinnedCharts", { count: pinnedDashboardWidgetCount })}
            </p>
            <p className="text-xs text-muted-foreground font-semibold">
              {t("dashboard.totalWidgets", { count: customWidgets.length })}
            </p>
          </div>
        </div>
        <div className="space-y-2 max-h-widget-customizer overflow-y-auto pe-1">
          {customWidgets.length === 0 ? (
            <EmptyState title={t("dashboard.noWidgets")} compact icon={null} className="italic" />
          ) : (
            customWidgets.map((widget, index) => (
              <CustomizeItemRow
                key={widget.id}
                id={`widget-pin-${widget.id}`}
                checked={Boolean(widget.isPinnedToDashboard)}
                onToggle={() => onToggleWidgetPin(widget.id)}
                title={resolveWidgetTitle(widget, t)}
                subtitle={getCollectionLabel(widget.collection, widget.collection, t)}
                actions={
                  <>
                    {onReorderWidgets && (
                      <div className="flex items-center gap-0.5">
                        <Button
                          onClick={() => handleMove(index, "up")}
                          disabled={index === 0}
                          variant="ghost"
                          size="icon"
                          className="border border-border/60 hover:border-primary/30 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shadow-none cursor-pointer rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                          title={t("dashboard.moveWidgetUp")}
                          aria-label={t("dashboard.moveWidgetUp")}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleMove(index, "down")}
                          disabled={index === customWidgets.length - 1}
                          variant="ghost"
                          size="icon"
                          className="border border-border/60 hover:border-primary/30 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shadow-none cursor-pointer rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                          title={t("dashboard.moveWidgetDown")}
                          aria-label={t("dashboard.moveWidgetDown")}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    <Button
                      onClick={() => onEditWidget(widget)}
                      variant="ghost"
                      size="icon"
                      className="border border-border/60 hover:border-primary/30 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shadow-none cursor-pointer rounded-lg"
                      title={t("dashboard.editWidget")}
                      aria-label={t("dashboard.editWidget")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {!isSeededDashboardWidget(widget.id) && (
                      <Button
                        onClick={() => onDeleteWidget(widget.id)}
                        variant="ghost"
                        size="icon"
                        className="border border-border/60 hover:border-destructive/30 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shadow-none cursor-pointer rounded-lg"
                        title={t("dashboard.deleteWidget")}
                        aria-label={t("dashboard.deleteWidget")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </>
                }
              />
            ))
          )}
        </div>
        <Button
          variant="capsOutline"
          size="caps"
          onClick={() => onOpenWidgetBuilder("kpi", null)}
          className="w-full border-dashed border-border/80 hover:border-primary/50 py-3.5"
        >
          <Plus className="w-4 h-4" />
          {t("dashboard.createWidget")}
        </Button>
      </fieldset>
    </SectionCard>
  );
}
