import React from "react";
import { capitalize, formatNumber } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { SafeResponsiveContainer } from "@mms/ui/app/SafeResponsiveContainer";
import { chartAxisTick } from "@mms/ui/app/ChartGrid";
import { EmptyState } from "@mms/ui";
import { useBrandPalette } from "../../host/useBrandPalette";
import { resolveWidgetChartHex } from "@mms/fe-core/ui/brandingChartPalette";
import { computeWidgetChartData, type getWidgetCollections } from "../../lib/widgetDataUtils";
import { THEME_PALETTES, type CustomWidget } from "../../lib/pinnedWidgetTypes";

function formatCategoryLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "—";
  return /^[a-z]/.test(trimmed) ? capitalize(trimmed) : trimmed;
}

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
        className="h-20 border-border/40 bg-card/20 rounded-xl uppercase tracking-wider"
      />
    );
  }

  const colors = THEME_PALETTES[widget.color] || THEME_PALETTES.emerald;
  const legendItems = chartData.slice(0, 4);

  return (
    <div className="space-y-2">
      <div className="h-20 w-full">
        {widget.chartType === "pie" ? (
          <SafeResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 1, height: 1 }}
          >
            <PieChart>
              <Tooltip
                formatter={(val) => formatNumber(Number(val ?? 0))}
                labelFormatter={(label) => formatCategoryLabel(String(label ?? ""))}
              />
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
        ) : (
          <SafeResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 1, height: 1 }}
          >
            <BarChart
              data={chartData}
              barSize={10}
              margin={{ top: 2, right: 4, left: -22, bottom: 2 }}
            >
              <XAxis
                dataKey="name"
                tick={chartAxisTick(9)}
                tickFormatter={(value) => formatCategoryLabel(String(value ?? ""))}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={chartAxisTick(8)} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(val) => formatNumber(Number(val ?? 0))}
                labelFormatter={(label) => formatCategoryLabel(String(label ?? ""))}
              />
              <Bar dataKey="value" fill={colorHex} radius={[2, 2, 0, 0]} />
            </BarChart>
          </SafeResponsiveContainer>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {legendItems.map((entry, idx) => (
          <span
            key={entry.name}
            className="inline-flex items-center gap-1.5 text-muted-foreground font-medium"
          >
            <span
              className="w-2 h-2 rounded-xs shrink-0"
              style={{
                backgroundColor:
                  widget.chartType === "pie" ? colors[idx % colors.length] : colorHex,
              }}
              aria-hidden="true"
            />
            <span className="truncate max-w-28">{formatCategoryLabel(entry.name)}:</span>
            <span className="font-bold text-foreground tabular-nums">
              {formatNumber(entry.value)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
