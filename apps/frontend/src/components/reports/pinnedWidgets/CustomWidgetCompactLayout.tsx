import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { resolveWidgetTitle } from "@/lib/dashboardWidgets";
import { isComposedWidgetType } from "@/components/dashboard-widgets/registry";
import { Switch } from "@/components/ui/switch";
import { SectionLabel } from "@/components/app/SectionLabel";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { METADATA_FIELDS, getCollectionLabel } from "@/lib/reports/reportMetadata";
import { ProgressRing } from "@/components/reports/pinnedWidgets/WidgetProgressRing";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import type { computeCustomCard } from "@/lib/reports/reportMetadata";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

type AlertScheme = {
  bg: string;
  text: string;
  border: string;
  glow: string;
} | null;

type ComputedCustomCard = ReturnType<typeof computeCustomCard>;

type CustomWidgetCompactLayoutProps = {
  widget: CustomWidget;
  resolvedWidgetType: string;
  computedCard: ComputedCustomCard | null;
  formattedValue: string;
  value: number;
  colorHex: string;
  alertScheme: AlertScheme;
  isSwitchOn: boolean;
  switchLabel: string;
  onSwitchToggle: (widget: CustomWidget) => void;
  onMetricClick: (widget: CustomWidget) => void;
  t: TranslationFunction;
};

export function CustomWidgetCompactLayout({
  widget,
  resolvedWidgetType,
  computedCard,
  formattedValue,
  value,
  colorHex,
  alertScheme,
  isSwitchOn,
  switchLabel,
  onSwitchToggle,
  onMetricClick,
  t,
}: CustomWidgetCompactLayoutProps): React.JSX.Element {
  if (resolvedWidgetType === "card") {
    if (!computedCard) return <></>;

    return (
      <motion.button
        whileHover={{ scale: 1.04, y: -2 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 450, damping: 20 }}
        onClick={() => onMetricClick(widget)}
        className={`size-widget-compact p-2.5 text-center flex flex-col justify-between items-center cursor-pointer outline-none select-none relative overflow-hidden ${WORK_SURFACE} hover:border-primary/20 hover:shadow-md`}
        type="button"
      >
        <span className="text-xs font-black uppercase text-muted-foreground tracking-wider line-clamp-1 w-full mt-0.5">
          {resolveWidgetTitle(widget, t)}
        </span>
        <span className="text-base font-black tracking-tight font-mono my-auto max-w-full truncate text-foreground">
          {computedCard.value}
        </span>
        <SectionLabel className="mb-0.5">
          {getCollectionLabel(
            widget.collection,
            METADATA_FIELDS[widget.collection]?.name || widget.collection,
            t,
          )}
        </SectionLabel>
      </motion.button>
    );
  }

  if (isComposedWidgetType(resolvedWidgetType)) {
    const displayAsProgress = resolvedWidgetType === "attendance-summary";
    return (
      <CompactMetricButton
        widget={widget}
        alertScheme={alertScheme}
        onMetricClick={onMetricClick}
        t={t}
        body={
          displayAsProgress ? (
            <ProgressRing percentage={value} colorHex={colorHex} isCompact />
          ) : (
            formattedValue
          )
        }
        bodyClassName={
          displayAsProgress ? undefined : alertScheme ? alertScheme.text : "text-foreground"
        }
        isProgress={displayAsProgress}
      />
    );
  }

  if (resolvedWidgetType === "kpi") {
    return (
      <CompactMetricButton
        widget={widget}
        alertScheme={alertScheme}
        onMetricClick={onMetricClick}
        t={t}
        body={formattedValue}
        bodyClassName={alertScheme ? alertScheme.text : "text-foreground"}
      />
    );
  }

  if (resolvedWidgetType === "progress") {
    return (
      <CompactMetricButton
        widget={widget}
        alertScheme={alertScheme}
        onMetricClick={onMetricClick}
        t={t}
        body={<ProgressRing percentage={value} colorHex={colorHex} isCompact />}
        isProgress
      />
    );
  }

  if (resolvedWidgetType === "switch") {
    return (
      <div
        className={`size-widget-compact p-2 text-center flex flex-col justify-between items-center ${WORK_SURFACE} overflow-hidden relative transition-all duration-300 hover:border-primary/20 hover:shadow-md`}
      >
        <span className="text-xs font-black uppercase text-muted-foreground tracking-wider line-clamp-1 w-full mt-0.5">
          {resolveWidgetTitle(widget, t)}
        </span>

        <Switch
          checked={isSwitchOn}
          onCheckedChange={() => onSwitchToggle(widget)}
          className="h-4 w-7"
          aria-label={switchLabel}
        />

        <SectionLabel className="mb-0.5" tone={isSwitchOn ? "primary" : "muted"}>
          {switchLabel}
        </SectionLabel>
      </div>
    );
  }

  return <></>;
}

function CompactMetricButton({
  widget,
  alertScheme,
  onMetricClick,
  t,
  body,
  bodyClassName,
  isProgress = false,
}: {
  widget: CustomWidget;
  alertScheme: AlertScheme;
  onMetricClick: (widget: CustomWidget) => void;
  t: TranslationFunction;
  body: React.ReactNode;
  bodyClassName?: string;
  isProgress?: boolean;
}): React.JSX.Element {
  return (
    <motion.button
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 450, damping: 20 }}
      onClick={() => onMetricClick(widget)}
      className={`size-widget-compact ${isProgress ? "p-1.5" : "p-2"} text-center flex flex-col justify-between items-center rounded-2xl border cursor-pointer outline-none select-none relative overflow-hidden ${
        alertScheme
          ? `${alertScheme.bg} ${alertScheme.border} ${alertScheme.glow}`
          : `${WORK_SURFACE} hover:border-primary/20 hover:shadow-md`
      }`}
      type="button"
    >
      <span
        className={cn(
          "text-xs font-black uppercase tracking-wider line-clamp-1 w-full mt-0.5",
          alertScheme ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {resolveWidgetTitle(widget, t)}
      </span>
      {isProgress ? (
        <div className="my-auto">{body}</div>
      ) : (
        <span
          className={`text-base font-black tracking-tight font-mono my-auto max-w-full truncate ${bodyClassName}`}
        >
          {body}
        </span>
      )}
      <SectionLabel tone={alertScheme ? "foreground" : "muted"} className="mb-0.5">
        {getCollectionLabel(
          widget.collection,
          METADATA_FIELDS[widget.collection]?.name || widget.collection,
          t,
        )}
      </SectionLabel>
    </motion.button>
  );
}
