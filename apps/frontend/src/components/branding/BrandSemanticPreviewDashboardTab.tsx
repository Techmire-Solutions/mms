import { BarChart3, TrendingUp } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";

import type { BrandSemanticPreviewContext } from "./brandColorPanelShared";

export function BrandSemanticPreviewDashboardTab({
  activeOnPrimaryBg,
  activeOnSecondaryBg,
}: BrandSemanticPreviewContext) {
  const { t } = useTranslation();

  return (
    <div className="p-4 space-y-4 bg-muted/10">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t("theme.previewMetricTitle")}
            </p>
            <p className="text-xl font-extrabold text-foreground tracking-tight">842</p>
            <div className="flex items-center gap-1 text-2xs font-semibold text-success">
              <TrendingUp className="h-3 w-3" />
              <span>{t("theme.previewMetricTrend")}</span>
            </div>
          </div>
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
            style={{ backgroundColor: activeOnPrimaryBg }}
          >
            <BarChart3 className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {t("theme.previewChartSeriesA")}
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: activeOnPrimaryBg }}>
              94.2%
            </span>
          </div>
          {/* Visual Progress Bar */}
          <div className="w-full h-2.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: "94.2%", backgroundColor: activeOnPrimaryBg }}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-foreground">
              {t("theme.previewChartSeriesB")}
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: activeOnSecondaryBg }}>
              88.6%
            </span>
          </div>
          <div className="w-full h-2.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: "88.6%", backgroundColor: activeOnSecondaryBg }}
            />
          </div>
        </div>
      </div>

      {/* Multi-series chart distribution mockup */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">{t("theme.previewChartTitle")}</p>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-3xs font-medium text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: activeOnPrimaryBg }}
              />
              {t("theme.previewPrimaryAction")}
            </span>
            <span className="flex items-center gap-1 text-3xs font-medium text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: activeOnSecondaryBg }}
              />
              {t("theme.previewAccentAction")}
            </span>
          </div>
        </div>

        {/* Chart Bar Mockup */}
        <div className="h-24 flex items-end justify-between gap-2 pt-2 px-2 border-b border-border/60">
          {[
            { label: "Mon", h1: "65%", h2: "45%" },
            { label: "Tue", h1: "80%", h2: "60%" },
            { label: "Wed", h1: "92%", h2: "75%" },
            { label: "Thu", h1: "85%", h2: "70%" },
            { label: "Fri", h1: "95%", h2: "85%" },
            { label: "Sat", h1: "70%", h2: "50%" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
            >
              <div className="w-full max-w-5 flex items-end gap-0.5 h-full">
                <div
                  className="flex-1 rounded-t-sm transition-all duration-300"
                  style={{ height: item.h1, backgroundColor: activeOnPrimaryBg }}
                />
                <div
                  className="flex-1 rounded-t-sm transition-all duration-300 opacity-80"
                  style={{ height: item.h2, backgroundColor: activeOnSecondaryBg }}
                />
              </div>
              <span className="text-3xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
