import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from "recharts";
import { SafeResponsiveContainer } from "@/components/ui/SafeResponsiveContainer";
import { chartAxisTick } from "@/components/ui/ChartGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { resolveWidgetChartHex } from "@/lib/brandingChartPalette";
import { computeWidgetChartData, type getWidgetCollections } from "@/lib/reports/widgetDataUtils";
import { THEME_PALETTES, type CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

export default function CustomWidgetChartFallback({
  widget,
  collections
}: {
  widget: CustomWidget;
  collections: ReturnType<typeof getWidgetCollections>;
}): React.JSX.Element | null {
  const { t } = useTranslation();
  const palette = useBrandPalette();
  const chartData = (() => {
    return computeWidgetChartData(widget, collections);
  })();

  const colorHex = resolveWidgetChartHex(widget.color, palette);

  if (chartData.length === 0) {
    return (
      <EmptyState
        title={t("reports.widgets.noChartData")}
        variant="dashed"
        compact
        icon={null}
        className="h-full border-border/40 bg-card/20 rounded-xl uppercase tracking-wider"
      />
    );
  }

  if (widget.chartType === "pie") {
    const colors = THEME_PALETTES[widget.color] || THEME_PALETTES.emerald;
    return (
      <SafeResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={14}
            outerRadius={28}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </SafeResponsiveContainer>
    );
  }

  return (
    <SafeResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
      <BarChart data={chartData} barSize={8} margin={{ top: 2, right: 2, left: -25, bottom: 2 }}>
        <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} />
        <YAxis tick={chartAxisTick(6)} axisLine={false} tickLine={false} />
        <Bar dataKey="value" fill={colorHex} radius={[2, 2, 0, 0]} />
      </BarChart>
    </SafeResponsiveContainer>
  );
}
