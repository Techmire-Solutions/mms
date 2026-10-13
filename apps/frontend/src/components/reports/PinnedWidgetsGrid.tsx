import type React from "react";
import { LayoutDashboard, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import type { AppTranslationKey } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { resolveWidgetTitle } from "@/lib/dashboardWidgets";
import type { ReportCollectionsSnapshot } from "@/lib/reports/useReportCollections";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { METADATA_FIELDS, getCollectionLabel } from "@/lib/reports/reportMetadata";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

const WIDGET_TYPE_LABEL_KEYS: Partial<
  Record<NonNullable<CustomWidget["widgetType"]>, AppTranslationKey>
> = {
  kpi: "reports.widgets.builder.typeKpi",
  card: "reports.widgets.builder.typeCard",
  progress: "reports.widgets.builder.typeProgress",
  switch: "reports.widgets.builder.typeSwitch",
  "sessions-list": "reports.widgets.builder.typeSessionsList",
  "attendance-summary": "reports.widgets.builder.typeAttendanceSummary",
  "attendance-rate": "reports.widgets.builder.typeAttendanceRate",
  "fee-summary": "reports.widgets.builder.typeFeeSummary",
  "outstanding-list": "reports.widgets.builder.typeOutstandingList",
  "overdue-obligations": "reports.widgets.builder.typeOverdueObligations",
  "enrollment-trends": "reports.widgets.builder.typeEnrollmentTrends",
  "revenue-expenses": "reports.widgets.builder.typeRevenueExpenses",
  "hasanat-distribution": "reports.widgets.builder.typeHasanatDistribution",
};

interface PinnedWidgetsGridProps {
  filteredWidgets: CustomWidget[];
  collections: ReportCollectionsSnapshot;
  onTogglePin: (id: string) => void;
  onEditClick: (widget: CustomWidget) => void;
  onDeleteWidget: (id: string) => void;
  onSwitchToggle: (widget: CustomWidget) => void;
  t: TranslationFunction;
  renderWidget: (widget: CustomWidget, collections: ReportCollectionsSnapshot) => React.ReactNode;
}

export function PinnedWidgetsGrid({
  filteredWidgets,
  collections,
  onTogglePin,
  onEditClick,
  onDeleteWidget,
  onSwitchToggle,
  renderWidget,
  t,
}: PinnedWidgetsGridProps): React.JSX.Element {
  if (filteredWidgets.length === 0) {
    return (
      <EmptyState
        title={t("reports.widgets.emptyTitle")}
        description={t("reports.widgets.emptyDescription")}
        icon={LayoutDashboard}
        variant="dashed"
        className="border-border/50 bg-card/10"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredWidgets.map((widget) => {
        const typeLabelKey = WIDGET_TYPE_LABEL_KEYS[widget.widgetType || "kpi"];
        return (
          <motion.div
            key={widget.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(WORK_SURFACE, "p-5 space-y-4 relative group text-start font-sans")}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <span className="block truncate text-xs font-black uppercase leading-none tracking-widest text-foreground">
                  {resolveWidgetTitle(widget, t)}
                </span>
                <SectionLabel as="p" weight="bold" tracking="wider" className="truncate">
                  {typeLabelKey ? t(typeLabelKey) : widget.widgetType || "kpi"} •{" "}
                  {getCollectionLabel(
                    widget.collection,
                    METADATA_FIELDS[widget.collection]?.name || widget.collection.replace("_", " "),
                    t,
                  )}
                </SectionLabel>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onTogglePin(widget.id)}
                  className={`rounded-lg border shadow-none ${
                    widget.isPinnedToDashboard
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  title={
                    widget.isPinnedToDashboard
                      ? t("reports.widgets.pinnedToDashboard")
                      : t("reports.widgets.pinToDashboard")
                  }
                >
                  {widget.isPinnedToDashboard ? (
                    <PinOff className="w-3.5 h-3.5" />
                  ) : (
                    <Pin className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onEditClick(widget)}
                  className="rounded-lg border border-border text-muted-foreground hover:text-primary hover:bg-primary/10 shadow-none"
                  title={t("reports.widgets.editWidget")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onDeleteWidget(widget.id)}
                  className="rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 shadow-none"
                  title={t("reports.widgets.deleteWidget")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <ErrorBoundary>{renderWidget(widget, collections)}</ErrorBoundary>
          </motion.div>
        );
      })}
    </div>
  );
}
