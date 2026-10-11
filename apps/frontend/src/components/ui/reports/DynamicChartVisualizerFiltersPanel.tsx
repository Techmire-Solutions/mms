import React from "react";
import { Plus, Trash2, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/FormSelect";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { getFieldLabel } from "@/lib/reports/reportMetadata";
import type { FilterRule } from "@/components/ui/reports/dynamicChartVisualizerTypes";
import type { DynamicChartVisualizerFiltersPanelProps } from "@/components/ui/reports/dynamicChartVisualizerConfigPanelTypes";

export function DynamicChartVisualizerFiltersPanel({
  filters,
  activeMeta,
  onAddFilter,
  onUpdateFilter,
  onDeleteFilter,
  t,
}: DynamicChartVisualizerFiltersPanelProps): React.JSX.Element {
  return (
    <div className={`${WORK_SURFACE} p-5 space-y-4`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="w-8 h-8 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Filter className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <SectionLabel as="h4" tone="foreground" className="leading-none truncate">
              {t("reports.visualizer.queryFilters")}
            </SectionLabel>
            <SectionLabel as="p" weight="bold" tracking="wider" className="mt-0.5 truncate">
              {t("reports.visualizer.filtersSubtitle")}
            </SectionLabel>
          </div>
        </div>
        <Button type="button" variant="capsOutline" size="caps" onClick={onAddFilter}>
          <Plus className="w-3 h-3" />
          {t("reports.visualizer.addRule")}
        </Button>
      </div>

      <div className="space-y-2.5 max-h-panel-sm overflow-y-auto pe-1">
        {filters.length === 0 ? (
          <EmptyState
            title={t("reports.visualizer.noFilters")}
            variant="dashed"
            compact
            icon={null}
            className="italic border-border/40 bg-card/10 rounded-2xl"
          />
        ) : (
          filters.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card/30 p-2.5 sm:flex-row sm:items-center"
            >
              <FormSelect
                value={rule.field}
                onChange={(val) => onUpdateFilter(rule.id, { field: val })}
                className="min-w-0 flex-1"
                aria-label={t("contacts.sync.conflictField")}
                options={activeMeta.fields.map((metadataField) => ({
                  value: metadataField.value,
                  label: getFieldLabel(metadataField.value, metadataField.label, t),
                }))}
              />

              <FormSelect
                value={rule.operator}
                onChange={(val) =>
                  onUpdateFilter(rule.id, { operator: val as FilterRule["operator"] })
                }
                className="w-full font-medium sm:w-24"
                aria-label={t("reports.widgets.builder.operator")}
                options={[
                  { value: "equals", label: "=" },
                  { value: "contains", label: "like" },
                  { value: "startsWith", label: "starts" },
                  ...(activeMeta.fields.find((field) => field.value === rule.field)?.isNumeric
                    ? [
                        { value: "gt", label: ">" },
                        { value: "lt", label: "<" },
                      ]
                    : []),
                ]}
              />

              <Input
                type="text"
                value={rule.value}
                onChange={(event) => onUpdateFilter(rule.id, { value: event.target.value })}
                placeholder={t("reports.visualizer.filterValuePlaceholder")}
                aria-label={t("reports.visualizer.filterValuePlaceholder")}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-card/60 px-2 py-2 text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onDeleteFilter(rule.id)}
                className="shrink-0 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive shadow-none"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
