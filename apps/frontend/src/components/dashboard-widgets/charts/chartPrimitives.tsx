import type { TooltipContentProps } from "recharts";
import { ChartTooltip } from "@/components/app/ChartTooltip";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

/** Shared `axisLine`/`tickLine` props for dashboard chart axes (repeated 8× before extraction). */
export const CHART_AXIS_LINE_PROPS = { axisLine: false, tickLine: false } as const;

/**
 * Single area-chart gradient def (5%→95% opacity fade). Shared by Attendance
 * and Revenue plots; Enrollment reuses it inside a `COLOR_MAP` loop.
 * Render inside `<defs>`.
 */
export function ChartAreaGradient({
  id,
  color,
  opacity = 0.18,
}: {
  id: string;
  color: string;
  opacity?: number;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={opacity} />
      <stop offset="95%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

export type ChartTooltipValueFormatter = (
  value: number,
  context: { t: TranslationFunction; name?: string | number },
) => string;

interface BuildChartTooltipOptions {
  valueFormatter: ChartTooltipValueFormatter;
  /** Use the series `name` as the title line instead of the axis `label`. */
  titleFromName?: boolean;
  labelClassName?: string;
}

/**
 * Factory for single-series chart tooltips wrapping {@link ChartTooltip}.
 * Replaces the per-chart inline `AttTooltip` / `CustomTooltip` / `HasanatTooltip`
 * components that all shared the `Partial<TooltipContentProps>` destructuring.
 */
export function buildChartTooltip({
  valueFormatter,
  titleFromName,
  labelClassName,
}: BuildChartTooltipOptions) {
  function BuiltChartTooltip({
    active = false,
    payload = [],
    label,
  }: Partial<TooltipContentProps>) {
    const { t } = useTranslation();
    const first = payload?.[0];
    const value =
      first != null ? valueFormatter(Number(first.value), { t, name: first?.name }) : undefined;
    return (
      <ChartTooltip
        active={active}
        payload={payload}
        label={titleFromName ? undefined : label}
        labelClassName={labelClassName}
        title={titleFromName ? first?.name : undefined}
        value={value}
      />
    );
  }
  return BuiltChartTooltip;
}
