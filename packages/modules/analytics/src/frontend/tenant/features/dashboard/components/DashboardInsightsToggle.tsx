import React from "react";
import { Badge, Button } from "@mms/ui";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import type { CustomWidget } from "../../../lib/pinnedWidgetTypes";
import { resolveWidgetTitle } from "../../../lib/dashboardWidgets";

interface DashboardInsightsToggleProps {
  widgets: readonly CustomWidget[];
  showInsights: boolean;
  onToggle: () => void;
  t: TranslationFunction;
}

const MAX_PREVIEW_PILLS = 4;

/** Disclosure bar for secondary analytics widgets with preview pills of hidden titles. */
export function DashboardInsightsToggle({
  widgets,
  showInsights,
  onToggle,
  t,
}: DashboardInsightsToggleProps): React.JSX.Element {
  const previewWidgets = widgets.slice(0, MAX_PREVIEW_PILLS);
  const remainingCount = Math.max(0, widgets.length - previewWidgets.length);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/40 px-4 py-2.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 w-full rounded-xl text-xs font-semibold sm:w-auto"
        aria-expanded={showInsights}
        onClick={onToggle}
      >
        {showInsights
          ? t("dashboard.hideInsights")
          : t("dashboard.showInsights", { count: widgets.length })}
      </Button>
      {!showInsights ? (
        <div className="hidden sm:flex flex-wrap items-center gap-1.5">
          {previewWidgets.map((widget) => (
            <Badge
              key={widget.id}
              as="span"
              pill
              tone="muted"
              className="text-xs font-medium text-muted-foreground"
            >
              {resolveWidgetTitle(widget, t)}
            </Badge>
          ))}
          {remainingCount > 0 ? (
            <span className="text-xs font-medium text-muted-foreground ps-1">
              {t("dashboard.insightsMoreCount", { count: remainingCount })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
