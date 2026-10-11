import React from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { resolveWidgetTitle } from "@/lib/dashboardWidgets";
import { getWidgetSubtitle } from "@/components/ui/reports/pinnedWidgets/customWidgetLayoutHelpers";
import {
  ComposedDashboardWidget,
  isComposedWidgetType,
} from "@/components/dashboard-widgets/registry";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { CARD_STRIPE_BASE, SEMANTIC_BADGE } from "@/lib/semanticTone";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/ui/reports/pinnedWidgets/WidgetProgressRing";
import { COLOR_MAP, type CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { CustomWidgetCardLayout } from "@/components/ui/reports/pinnedWidgets/CustomWidgetCardLayout";
import type { ReportCollectionsSnapshot } from "@/lib/reports/useReportCollections";
import type { computeCustomCard } from "@/lib/reports/reportMetadata";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const CustomWidgetChartFallback = React.lazy(
  () => import("@/components/ui/reports/pinnedWidgets/CustomWidgetChartFallback"),
);

type AlertScheme = {
  bg: string;
  text: string;
  border: string;
  glow: string;
} | null;

type ComputedCustomCard = ReturnType<typeof computeCustomCard>;

type CustomWidgetComfortableLayoutProps = {
  widget: CustomWidget;
  collections: ReportCollectionsSnapshot;
  resolvedWidgetType: string;
  computedCard: ComputedCustomCard | null;
  formattedValue: string;
  value: number;
  colorHex: string;
  alertScheme: AlertScheme;
  isAlert: boolean;
  isSwitchOn: boolean;
  switchLabel: string;
  isEditMode: boolean;
  onSwitchToggle: (widget: CustomWidget) => void;
  onMetricClick: (widget: CustomWidget) => void;
  t: TranslationFunction;
};

export function CustomWidgetComfortableLayout({
  widget,
  collections,
  resolvedWidgetType,
  computedCard,
  formattedValue,
  value,
  colorHex,
  alertScheme,
  isAlert,
  isSwitchOn,
  switchLabel,
  isEditMode,
  onSwitchToggle,
  onMetricClick,
  t,
}: CustomWidgetComfortableLayoutProps): React.JSX.Element {
  if (resolvedWidgetType === "card") {
    if (!computedCard) return <></>;
    return <CustomWidgetCardLayout computedCard={computedCard} />;
  }

  if (isComposedWidgetType(resolvedWidgetType)) {
    return (
      <ComposedDashboardWidget
        type={resolvedWidgetType}
        title={resolveWidgetTitle(widget, t)}
        isEditMode={isEditMode}
      />
    );
  }

  const colorTheme = COLOR_MAP[widget.color || ""] || COLOR_MAP.emerald;

  return (
    <motion.div
      layout
      whileHover={{ y: -4, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`p-5 flex flex-col justify-between shadow-sm relative group hover:shadow-surface-lg transition-all overflow-hidden ${
        alertScheme
          ? `rounded-2xl ${alertScheme.bg} ${alertScheme.border} ${alertScheme.glow} border-2`
          : WORK_SURFACE
      }`}
    >
      <div
        aria-hidden="true"
        className={cn(
          CARD_STRIPE_BASE,
          "transition-colors duration-300",
          isAlert ? "bg-destructive/60 group-hover:bg-destructive" : `${colorTheme.bar}/60`,
        )}
      />
      <div
        className={`absolute -end-8 -top-8 w-24 h-24 rounded-full ${colorTheme.glow} transition-all duration-500`}
      />
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5 text-start">
          <SectionLabel tone="foreground" className="block truncate leading-none">
            {resolveWidgetTitle(widget, t)}
          </SectionLabel>
          <p
            className={cn(
              "truncate text-xs font-bold uppercase tracking-wider",
              alertScheme ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {getWidgetSubtitle(widget, resolvedWidgetType, t)}
          </p>
        </div>

        {isAlert && (
          <StatusBadge
            status="alert"
            size="sm"
            config={{
              alert: {
                label: t("reports.widgets.alertLevel"),
                cls: SEMANTIC_BADGE.destructiveSolid,
              },
            }}
          />
        )}
      </div>

      <div className="py-4 flex items-center justify-between min-h-18">
        {resolvedWidgetType === "kpi" && (
          <Button
            onClick={() => onMetricClick(widget)}
            className="h-auto text-start select-none outline-none group/kpi shadow-none px-0 py-0 hover:bg-transparent"
            type="button"
            variant="ghost"
          >
            <span className="block">
              <h4
                className={`text-3xl font-black tracking-tight font-mono flex items-baseline gap-1.5 ${alertScheme ? alertScheme.text : "text-foreground"}`}
              >
                {formattedValue}
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/35 transition-all group-hover/kpi:translate-x-0.5 group-hover/kpi:-translate-y-0.5 group-hover/kpi:text-primary rtl:-scale-x-100 rtl:group-hover/kpi:-translate-x-0.5" />
              </h4>
              <p
                className={cn(
                  "text-xs font-bold uppercase tracking-wider mt-1",
                  alertScheme ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t("reports.widgets.clickToViewRecords")}
              </p>
            </span>
          </Button>
        )}

        {resolvedWidgetType === "progress" && (
          <div className="flex items-center gap-4 w-full">
            <Button
              onClick={() => onMetricClick(widget)}
              className="flex-1 h-auto text-start outline-none group/prog shadow-none px-0 py-0 hover:bg-transparent justify-start"
              type="button"
              variant="ghost"
            >
              <span className="block">
                <h4 className="text-sm font-black text-foreground flex items-center gap-1">
                  {t("reports.widgets.progression")}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover/prog:translate-x-0.5 rtl:rotate-180 rtl:group-hover/prog:-translate-x-0.5" />
                </h4>
                <p
                  className={cn(
                    "text-xs font-semibold mt-1",
                    alertScheme ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t("reports.widgets.progressionDesc")}
                </p>
              </span>
            </Button>
            <ProgressRing percentage={value} colorHex={colorHex} />
          </div>
        )}

        {resolvedWidgetType === "switch" && (
          <div className="flex items-center justify-between w-full">
            <div className="text-start">
              <span
                className={`text-base font-black uppercase tracking-wider ${isSwitchOn ? "text-primary" : "text-muted-foreground"}`}
              >
                {switchLabel}
              </span>
              <p
                className={cn(
                  "text-xs font-semibold mt-1",
                  alertScheme ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t("reports.widgets.clickToToggle")}
              </p>
            </div>

            <Switch
              checked={isSwitchOn}
              onCheckedChange={() => onSwitchToggle(widget)}
              className="h-6 w-11"
              aria-label={switchLabel}
            />
          </div>
        )}

        {resolvedWidgetType === "chart" && (
          <div className="w-full h-20 -mb-2">
            <React.Suspense
              fallback={<div className="w-full h-full bg-muted/20 animate-pulse rounded-xl" />}
            >
              <CustomWidgetChartFallback widget={widget} collections={collections} />
            </React.Suspense>
          </div>
        )}
      </div>
    </motion.div>
  );
}
