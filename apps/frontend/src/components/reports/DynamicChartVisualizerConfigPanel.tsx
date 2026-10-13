import React from "react";
import { Sparkles } from "lucide-react";
import { SectionLabel } from "@/components/app/SectionLabel";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { DynamicChartVisualizerFiltersPanel } from "@/components/reports/DynamicChartVisualizerFiltersPanel";
import { DynamicChartVisualizerConfigFields } from "@/components/reports/DynamicChartVisualizerConfigFields";
import type { DynamicChartVisualizerConfigPanelProps } from "@/components/reports/dynamicChartVisualizerConfigPanelTypes";

export type { DynamicChartVisualizerConfigPanelProps } from "@/components/reports/dynamicChartVisualizerConfigPanelTypes";

export function DynamicChartVisualizerConfigPanel(
  props: DynamicChartVisualizerConfigPanelProps,
): React.JSX.Element {
  const { filters, activeMeta, onAddFilter, onUpdateFilter, onDeleteFilter, t } = props;

  return (
    <div className="lg:col-span-5 space-y-5 print:hidden">
      <div className={`${WORK_SURFACE} p-5 space-y-4`}>
        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <SectionLabel as="h4" tone="foreground" className="leading-none">
              {t("reports.visualizer.configTitle")}
            </SectionLabel>
            <SectionLabel as="p" weight="bold" tracking="wider" className="mt-0.5">
              {t("reports.visualizer.configSubtitle")}
            </SectionLabel>
          </div>
        </div>

        <DynamicChartVisualizerConfigFields {...props} />
      </div>

      <DynamicChartVisualizerFiltersPanel
        filters={filters}
        activeMeta={activeMeta}
        onAddFilter={onAddFilter}
        onUpdateFilter={onUpdateFilter}
        onDeleteFilter={onDeleteFilter}
        t={t}
      />
    </div>
  );
}
