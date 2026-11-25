/**
 * Chart geometry for the active writing direction.
 *
 * Recharts is LTR by default: in Arabic/Urdu/Farsi the month axis must run
 * right-to-left, the value axis moves to the right and legends/tooltips align with
 * the text. Data is unchanged — only axis and legend geometry flips.
 */
export interface ChartDirection {
  xAxisReversed: boolean;
  yAxisOrientation: "left" | "right";
  legendAlign: "left" | "right";
  legendDirection: "ltr" | "rtl";
}

export function chartDirection(isRtl: boolean): ChartDirection {
  return isRtl
    ? {
        xAxisReversed: true,
        yAxisOrientation: "right",
        legendAlign: "right",
        legendDirection: "rtl",
      }
    : {
        xAxisReversed: false,
        yAxisOrientation: "left",
        legendAlign: "left",
        legendDirection: "ltr",
      };
}
