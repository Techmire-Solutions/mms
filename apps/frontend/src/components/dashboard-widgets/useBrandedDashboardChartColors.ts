import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";

interface EnrollmentColorConfig {
  stroke: string;
  stop: string;
  text: string;
  bg: string;
  fill: string;
}

interface RevenueThemeColors {
  revenue: string;
  expenses: string;
  fillOpacityRevenue: number;
  fillOpacityExpenses: number;
}

interface HasanatThemeColors {
  mem: string;
  att: string;
  beh: string;
}

/**
 * Dashboard chart colour maps derived from institution branding (Recharts cannot use CSS vars).
 */
export function useBrandedDashboardChartColors(): {
  enrollment: Record<string, EnrollmentColorConfig>;
  attendance: Record<string, string>;
  revenue: Record<string, RevenueThemeColors>;
  hasanat: Record<string, HasanatThemeColors>;
  pie: string[];
} {
  const palette = useBrandPalette();

  return (() => {
    const { primary, secondary, charts } = palette;
    const brandedEnroll = (key: string): EnrollmentColorConfig => ({
      stroke: primary,
      stop: primary,
      text: "text-primary",
      bg: "bg-primary/10",
      fill: `url(#enrollGrad-${key})`,
    });

    const enrollment: Record<string, EnrollmentColorConfig> = {
      brand: brandedEnroll("brand"),
      emerald: brandedEnroll("emerald"),
      blue: {
        stroke: charts[3],
        stop: charts[3],
        text: "text-info",
        bg: "bg-info/10",
        fill: "url(#enrollGrad-blue)",
      },
      violet: {
        stroke: charts[4],
        stop: charts[4],
        text: "text-primary",
        bg: "bg-primary/10",
        fill: "url(#enrollGrad-violet)",
      },
      amber: {
        stroke: secondary,
        stop: secondary,
        text: "text-warning",
        bg: "bg-warning/10",
        fill: "url(#enrollGrad-amber)",
      },
      red: {
        stroke: charts[0],
        stop: charts[0],
        text: "text-destructive",
        bg: "bg-destructive/10",
        fill: "url(#enrollGrad-red)",
      },
    };

    const attendance: Record<string, string> = {
      brand: primary,
      emerald: primary,
      mixed: primary,
      blue: charts[3],
      violet: charts[4],
      amber: secondary,
      red: charts[0],
    };

    const revenue: Record<string, RevenueThemeColors> = {
      brand: {
        revenue: primary,
        expenses: secondary,
        fillOpacityRevenue: 0.85,
        fillOpacityExpenses: 0.7,
      },
      mixed: {
        revenue: primary,
        expenses: charts[2],
        fillOpacityRevenue: 0.85,
        fillOpacityExpenses: 0.7,
      },
      emerald: {
        revenue: primary,
        expenses: charts[1],
        fillOpacityRevenue: 0.85,
        fillOpacityExpenses: 0.5,
      },
      violet: {
        revenue: charts[4],
        expenses: charts[3],
        fillOpacityRevenue: 0.85,
        fillOpacityExpenses: 0.5,
      },
      blue: {
        revenue: charts[3],
        expenses: charts[1],
        fillOpacityRevenue: 0.85,
        fillOpacityExpenses: 0.5,
      },
      amber: {
        revenue: secondary,
        expenses: charts[2],
        fillOpacityRevenue: 0.85,
        fillOpacityExpenses: 0.5,
      },
      red: {
        revenue: charts[0],
        expenses: charts[1],
        fillOpacityRevenue: 0.85,
        fillOpacityExpenses: 0.5,
      },
    };

    const hasanat: Record<string, HasanatThemeColors> = {
      brand: { mem: primary, att: secondary, beh: charts[2] },
      mixed: { mem: primary, att: secondary, beh: charts[2] },
      emerald: { mem: primary, att: charts[1], beh: charts[3] },
      blue: { mem: charts[3], att: charts[1], beh: charts[4] },
      violet: { mem: charts[4], att: charts[2], beh: charts[3] },
    };

    return {
      enrollment,
      attendance,
      revenue,
      hasanat,
      pie: [...charts],
    };
  })();
}
