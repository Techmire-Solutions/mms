import React from "react";
import type { AppTranslationKey } from "@mms/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionLabel } from "@/components/ui/SectionLabel";

export interface DynamicChartVisualizerDisplayFieldsProps {
  showGrid: boolean;
  setShowGrid: (val: boolean) => void;
  showLegend: boolean;
  setShowLegend: (val: boolean) => void;
  showTooltip: boolean;
  setShowTooltip: (val: boolean) => void;
  t: (key: AppTranslationKey) => string;
}

export function DynamicChartVisualizerDisplayFields({
  showGrid,
  setShowGrid,
  showLegend,
  setShowLegend,
  showTooltip,
  setShowTooltip,
  t,
}: DynamicChartVisualizerDisplayFieldsProps): React.JSX.Element {
  return (
    <div className="pt-2">
      <SectionLabel weight="bold" tracking="wider" className="block mb-2">
        {t("reports.visualizer.displayCustomizations")}
      </SectionLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card/25 hover:bg-card/45 transition-colors text-xs font-semibold text-foreground">
          <Checkbox
            id="display-show-grid"
            checked={showGrid}
            onCheckedChange={(checked) => setShowGrid(Boolean(checked))}
          />
          <label htmlFor="display-show-grid" className="cursor-pointer select-none">
            {t("reports.visualizer.gridLines")}
          </label>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card/25 hover:bg-card/45 transition-colors text-xs font-semibold text-foreground">
          <Checkbox
            id="display-show-legend"
            checked={showLegend}
            onCheckedChange={(checked) => setShowLegend(Boolean(checked))}
          />
          <label htmlFor="display-show-legend" className="cursor-pointer select-none">
            {t("reports.visualizer.legends")}
          </label>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card/25 hover:bg-card/45 transition-colors text-xs font-semibold text-foreground">
          <Checkbox
            id="display-show-tooltip"
            checked={showTooltip}
            onCheckedChange={(checked) => setShowTooltip(Boolean(checked))}
          />
          <label htmlFor="display-show-tooltip" className="cursor-pointer select-none">
            {t("reports.visualizer.tooltips")}
          </label>
        </div>
      </div>
    </div>
  );
}
