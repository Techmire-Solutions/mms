import type { Dispatch, JSX, SetStateAction } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompactSegmentedControl } from "@/components/app/CompactSegmentedControl";
import { EmptyState } from "@/components/app/EmptyState";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";
import { SectionLabel } from "@/components/app/SectionLabel";
import { useTranslation } from "@/hooks/useTranslation";
import { getStandardPageSizeOptions } from "@/components/app/ExportPdfSettingsPopover";
import {
  getAggregateFunctionOptions,
  getReportDataSourceOptions,
  getSelectedFieldsForSource,
  type AggregateFn,
  type DataSource,
} from "./customReportBuilderFields";

interface CustomReportBuilderConfigPanelProps {
  reportName: string;
  setReportName: Dispatch<SetStateAction<string>>;
  source: DataSource;
  setSource: Dispatch<SetStateAction<DataSource>>;
  selectedFields: string[];
  setSelectedFields: Dispatch<SetStateAction<string[]>>;
  availableFields: string[];
  addField: (field: string) => void;
  aggregate: AggregateFn;
  setAggregate: Dispatch<SetStateAction<AggregateFn>>;
  groupBy: string;
  setGroupBy: Dispatch<SetStateAction<string>>;
  orientation: "p" | "l";
  setOrientation: Dispatch<SetStateAction<"p" | "l">>;
  pageSize: string;
  setPageSize: Dispatch<SetStateAction<string>>;
  resolveFieldLabel: (field: string) => string;
}

export function CustomReportBuilderConfigPanel({
  reportName,
  setReportName,
  source,
  setSource,
  selectedFields,
  setSelectedFields,
  availableFields,
  addField,
  aggregate,
  setAggregate,
  groupBy,
  setGroupBy,
  orientation,
  setOrientation,
  pageSize,
  setPageSize,
  resolveFieldLabel,
}: CustomReportBuilderConfigPanelProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-5 lg:col-span-1">
      <div className="space-y-1.5">
        <SectionLabel as="label" htmlFor="report-builder-name" weight="bold" className="block">
          {t("reports.builder.reportTitleLabel")}
        </SectionLabel>
        <Input
          id="report-builder-name"
          name="reportName"
          type="text"
          value={reportName}
          onChange={(event) => setReportName(event.target.value)}
          placeholder={t("reports.builder.placeholderName")}
          className="w-full text-xs font-semibold rounded-xl border border-border bg-card/50 px-4 py-2.5 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all text-foreground h-auto"
        />
      </div>

      <div className="space-y-1.5">
        <SectionLabel as="label" htmlFor="report-builder-source" weight="bold" className="block">
          {t("reports.builder.queryDataSource")}
        </SectionLabel>
        <FormSelect
          id="report-builder-source"
          name="reportSource"
          value={source}
          onChange={(value) => {
            const newSource = value as DataSource;
            setSource(newSource);
            setSelectedFields(getSelectedFieldsForSource(newSource));
          }}
          options={getReportDataSourceOptions(t)}
          className="w-full"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <SectionLabel weight="bold" className="block">
            {t("reports.builder.schemaFieldsPicker")}
          </SectionLabel>
          <span className="text-xs text-muted-foreground font-black uppercase bg-primary/10 px-1.5 py-0.5 rounded-md text-primary">
            {t("reports.builder.availableCount", { count: availableFields.length })}
          </span>
        </div>
        <div className="rounded-2xl border border-border bg-background/30 p-2.5 space-y-1 max-h-52 overflow-y-auto custom-scrollbar">
          {availableFields.length === 0 ? (
            <EmptyState
              title={t("reports.builder.allFieldsSelected")}
              icon={Check}
              compact
              className="italic"
            />
          ) : (
            availableFields.map((availableField) => (
              <Button
                key={availableField}
                onClick={() => addField(availableField)}
                variant="ghost"
                className="w-full flex items-center gap-2.5 px-3 rounded-xl hover:bg-primary/10 text-xs font-semibold text-start text-foreground transition-all group cursor-pointer justify-start"
                type="button"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-transform shrink-0" />
                <span className="min-w-0 truncate">{resolveFieldLabel(availableField)}</span>
              </Button>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
        <div className="space-y-1.5">
          <SectionLabel
            as="label"
            htmlFor="report-builder-aggregate"
            weight="bold"
            className="block"
          >
            {t("reports.builder.aggregatorFunction")}
          </SectionLabel>
          <FormSelect
            id="report-builder-aggregate"
            name="reportAggregate"
            value={aggregate}
            onChange={(value) => setAggregate(value as AggregateFn)}
            options={getAggregateFunctionOptions(t)}
            className="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <SectionLabel
            as="label"
            htmlFor="report-builder-group-by"
            weight="bold"
            className="block"
          >
            {t("reports.builder.groupCategory")}
          </SectionLabel>
          <FormSelect
            id="report-builder-group-by"
            name="reportGroupBy"
            value={groupBy}
            disabled={aggregate === "None"}
            onChange={(value) => setGroupBy(value)}
            options={[
              { value: "", label: t("reports.builder.noGrouping") },
              ...selectedFields.map((field) => ({ value: field, label: resolveFieldLabel(field) })),
            ]}
            className="w-full text-xs font-semibold rounded-xl border border-border bg-card/50 px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
        <div className="space-y-1.5">
          <SectionLabel weight="bold" className="block">
            {t("reports.builder.docAlignment")}
          </SectionLabel>
          <CompactSegmentedControl
            tone="card"
            fill
            ariaLabel={t("reports.builder.docAlignment")}
            value={orientation}
            onChange={setOrientation}
            options={[
              { value: "p", label: t("reports.builder.portrait") },
              { value: "l", label: t("reports.builder.landscape") },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <SectionLabel
            as="label"
            htmlFor="report-builder-page-size"
            weight="bold"
            className="block"
          >
            {t("reports.builder.exportLayoutFormat")}
          </SectionLabel>
          <FormSelect
            id="report-builder-page-size"
            name="reportPageSize"
            value={pageSize}
            onChange={(value) => setPageSize(value)}
            options={getStandardPageSizeOptions(t)}
            className="w-full animate-none"
          />
        </div>
      </div>
    </div>
  );
}
