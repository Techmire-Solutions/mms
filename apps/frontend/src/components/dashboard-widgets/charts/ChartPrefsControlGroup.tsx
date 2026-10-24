import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORM_SELECT_MINI } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import {
  DASHBOARD_CHART_COLOR_OPTIONS,
  type ChartColorOption,
  type ChartOption,
} from "@mms/shared";

/** Shared container class for the edit-mode chart preference controls. */
const PREFS_GROUP_CLASS =
  "flex items-center gap-1 bg-muted/65 p-0.5 rounded-lg border border-border/50";

function resolveColorOptions(subset: readonly ChartColorOption[]): ChartOption<ChartColorOption>[] {
  return subset
    .map((value) => DASHBOARD_CHART_COLOR_OPTIONS.find((option) => option.value === value))
    .filter((option): option is ChartOption<ChartColorOption> => Boolean(option));
}

interface ChartPrefsControlGroupProps {
  chartTypeValue: string;
  chartTypeOptions: readonly ChartOption<string>[];
  onChartTypeChange: (value: string) => void;
  colorValue: string;
  colorOptions: readonly ChartColorOption[];
  onColorChange: (value: string) => void;
  /** Optional extra control rendered after the color picker (e.g. period select). */
  children?: ReactNode;
}

/**
 * Edit-mode chart-type + color picker group shared by all dashboard chart widgets.
 * Replaces per-chart copy-pasted `<Select>` blocks; driven by shared option arrays.
 */
export function ChartPrefsControlGroup({
  chartTypeValue,
  chartTypeOptions,
  onChartTypeChange,
  colorValue,
  colorOptions,
  onColorChange,
  children,
}: ChartPrefsControlGroupProps) {
  const { t } = useTranslation();
  const colors = resolveColorOptions(colorOptions);

  return (
    <div className={PREFS_GROUP_CLASS}>
      <Select value={chartTypeValue} onValueChange={onChartTypeChange}>
        <SelectTrigger className={FORM_SELECT_MINI} aria-label={t("reports.visualizer.chartType")}>
          <SelectValue placeholder={t("reports.visualizer.chartType")} />
        </SelectTrigger>
        <SelectContent>
          {chartTypeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={colorValue} onValueChange={onColorChange}>
        <SelectTrigger
          className={FORM_SELECT_MINI}
          aria-label={t("reports.visualizer.colorPalette")}
        >
          <SelectValue placeholder={t("reports.visualizer.colorPalette")} />
        </SelectTrigger>
        <SelectContent>
          {colors.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {children}
    </div>
  );
}
