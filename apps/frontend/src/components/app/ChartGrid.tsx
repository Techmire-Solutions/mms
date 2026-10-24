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
 */
export function chartAxisTick(fontSize = 11, muted = false): { fontSize: number; fill?: string } {
  return muted ? { fontSize, fill: "hsl(var(--muted-foreground))" } : { fontSize };
}
