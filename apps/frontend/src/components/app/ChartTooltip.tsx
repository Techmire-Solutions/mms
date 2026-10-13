import type { CSSProperties, ReactNode } from "react";
import type { TooltipContentProps } from "recharts";
import { cn } from "@/lib/utils";
import { LegendChip } from "@/components/app/LegendChip";

export interface ChartTooltipProps extends Partial<TooltipContentProps> {
  /** Overrides the label line (defaults to `label`). */
  title?: ReactNode;
  /** Single bold value line for single-series tooltips. */
  value?: ReactNode;
  /** Label line className override (tone / margin / weight). */
  labelClassName?: string;
  /** Multi-row content (ChartTooltipRow children). */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Recharts tooltip glass-panel shell — SSOT for the
 * `surface-glass rounded-xl px-3.5 py-2.5 shadow-lg text-xs` content chrome
 * shared by the dashboard widget chart tooltips. Recharts injects
 * `active`/`payload`/`label` into the cloned element at render time; render
 * via `<Tooltip content={<ChartTooltip ... />} />`. Rows via {@link ChartTooltipRow}.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  title,
  value,
  labelClassName,
  children,
  className,
  style,
}: ChartTooltipProps): React.JSX.Element | null {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        "surface-overlay rounded-xl px-3.5 py-2.5 text-xs text-start select-none",
        className,
      )}
      style={style}
    >
      {title != null
        ? title
        : label != null && (
            <p className={cn("text-muted-foreground text-xs m-0", labelClassName)}>{label}</p>
          )}
      {value != null ? (
        <p className="font-bold text-foreground m-0 tabular-nums">{value}</p>
      ) : (
        children
      )}
    </div>
  );
}

export interface ChartTooltipRowProps {
  /** Series color dot (inline background). */
  color?: string;
  name: ReactNode;
  value: ReactNode;
  nameClassName?: string;
  valueClassName?: string;
}

/** Single series row inside a {@link ChartTooltip} — color dot + name + value. */
export function ChartTooltipRow({
  color,
  name,
  value,
  nameClassName,
  valueClassName,
}: ChartTooltipRowProps): React.JSX.Element {
  return (
    <LegendChip
      gap="md"
      dotSize="sm"
      dotStyle={color != null ? { background: color } : undefined}
      label={name}
      labelClassName={cn("text-muted-foreground", nameClassName)}
      value={value}
      valueClassName={valueClassName}
    />
  );
}
