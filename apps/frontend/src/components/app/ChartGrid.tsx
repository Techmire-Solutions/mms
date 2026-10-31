import { CartesianGrid, PolarGrid } from "recharts";
import type { CartesianGridProps, PolarGridProps } from "recharts";

export type ChartGridProps = CartesianGridProps;

/**
 * SSOT for the `strokeDasharray="3 3" stroke="hsl(var(--border))"` Recharts
 * cartesian grid chrome. Defaults are applied via destructuring so per-site
 * `vertical` / `horizontal` props pass through unchanged.
 */
export function ChartGrid({
  strokeDasharray = "3 3",
  stroke = "hsl(var(--border))",
  ...props
}: ChartGridProps): React.JSX.Element {
  return <CartesianGrid strokeDasharray={strokeDasharray} stroke={stroke} {...props} />;
}

/** SSOT for the `stroke="hsl(var(--border))"` Recharts polar grid. */
export function ChartPolarGrid({
  stroke = "hsl(var(--border))",
  ...props
}: PolarGridProps): React.JSX.Element {
  return <PolarGrid stroke={stroke} {...props} />;
}

/**
 * SSOT axis tick object — the repeated `tick={{ fontSize: N }}` config shared
 * by every report/widget chart. `muted` adds the muted-foreground fill used by
 * the dashboard widget dialect.
 *
 * Size is clamped to the 12 px token floor: individual charts used to pass
 * 10/11, which bypassed the token scale and produced 146 sub-floor SVG text
 * nodes in the 2026-10-31 corpus.
 */
export const CHART_TEXT_MIN_PX = 12;

export function chartAxisTick(
  fontSize = CHART_TEXT_MIN_PX,
  muted = false,
): {
  fontSize: number;
  fill?: string;
} {
  const size = Math.max(fontSize, CHART_TEXT_MIN_PX);
  return muted ? { fontSize: size, fill: "hsl(var(--muted-foreground))" } : { fontSize: size };
}
