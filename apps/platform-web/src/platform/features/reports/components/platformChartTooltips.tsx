import { buildChartTooltip } from "@/components/dashboard-widgets/charts/chartPrimitives";

export const PlatformCountTooltip = buildChartTooltip({
  valueFormatter: (value) => String(value),
});

export const PlatformDistributionTooltip = buildChartTooltip({
  valueFormatter: (value) => String(value),
  titleFromName: true,
});
