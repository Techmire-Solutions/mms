/**
 * Standardized date range presets and calculation utilities for module reporting tabs.
 */

export type ReportDatePreset =
  "none" | "today" | "7d" | "30d" | "90d" | "thisMonth" | "lastMonth" | "allTime";

export interface DateRangeResult {
  from: string;
  to: string;
}

/**
 * Calculates a [from, to] ISO string range based on a preset.
 */
export function calculateReportDateRange(
  preset: ReportDatePreset,
  baseDate: Date = new Date(),
): DateRangeResult {
  const toStr = baseDate.toISOString().slice(0, 10);

  switch (preset) {
    case "today":
      return { from: toStr, to: toStr };

    case "7d": {
      const start = new Date(baseDate);
      start.setDate(baseDate.getDate() - 7);
      return { from: start.toISOString().slice(0, 10), to: toStr };
    }

    case "30d": {
      const start = new Date(baseDate);
      start.setDate(baseDate.getDate() - 30);
      return { from: start.toISOString().slice(0, 10), to: toStr };
    }

    case "90d": {
      const start = new Date(baseDate);
      start.setDate(baseDate.getDate() - 90);
      return { from: start.toISOString().slice(0, 10), to: toStr };
    }

    case "thisMonth": {
      const year = baseDate.getFullYear();
      const month = String(baseDate.getMonth() + 1).padStart(2, "0");
      const start = `${year}-${month}-01`;
      return { from: start, to: toStr };
    }

    case "lastMonth": {
      const year = baseDate.getMonth() === 0 ? baseDate.getFullYear() - 1 : baseDate.getFullYear();
      const monthNum = baseDate.getMonth() === 0 ? 12 : baseDate.getMonth();
      const month = String(monthNum).padStart(2, "0");
      const lastDay = new Date(year, monthNum, 0).getDate();
      return {
        from: `${year}-${month}-01`,
        to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
      };
    }

    case "none":
    case "allTime":
    default:
      return { from: "", to: "" };
  }
}
