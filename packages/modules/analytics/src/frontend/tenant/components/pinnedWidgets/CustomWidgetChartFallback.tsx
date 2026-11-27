import React from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from "recharts";
import { SafeResponsiveContainer } from "@mms/ui/app/SafeResponsiveContainer";
import { chartAxisTick } from "@mms/ui/app/ChartGrid";
import { EmptyState } from "@mms/ui";
import { useBrandPalette } from "../../host/useBrandPalette";
import { resolveWidgetChartHex } from "@mms/fe-core/ui/brandingChartPalette";
import { computeWidgetChartData, type getWidgetCollections } from "../../lib/widgetDataUtils";
import { THEME_PALETTES, type CustomWidget } from "../../lib/pinnedWidgetTypes";

export default function CustomWidgetChartFallback({
  widget,
  collections,
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
      <SafeResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={0}
        initialDimension={{ width: 1, height: 1 }}
      >
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
            {chartData.map((_: any, index: any) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </SafeResponsiveContainer>
    );
  }

  return (
    <SafeResponsiveContainer
      width="100%"
      height="100%"
      minWidth={0}
      minHeight={0}
      initialDimension={{ width: 1, height: 1 }}
    >
      <BarChart data={chartData} barSize={8} margin={{ top: 2, right: 2, left: -25, bottom: 2 }}>
        <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} />
        <YAxis tick={chartAxisTick(6)} axisLine={false} tickLine={false} />
        <Bar dataKey="value" fill={colorHex} radius={[2, 2, 0, 0]} />
      </BarChart>
    </SafeResponsiveContainer>
  );
}
