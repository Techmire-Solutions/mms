import React from "react";
import { Field } from "@mms/ui/app/FormField";
import { FORM_INPUT_BUILDER } from "@mms/ui";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { Input } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  METADATA_FIELDS,
  COLLECTION_OPTIONS,
  getFieldLabel,
  getCollectionLabel,
} from "../../lib/reportMetadata";
import type { CustomWidget } from "../../lib/pinnedWidgetTypes";

interface WidgetBuilderMetricOptionsProps {
  builderCollection: CustomWidget["collection"];
  setBuilderCollection: (builderCollection: CustomWidget["collection"]) => void;
  builderOperation: CustomWidget["operation"];
  setBuilderOperation: (builderOperation: CustomWidget["operation"]) => void;
  builderTargetField: string;
  setBuilderTargetField: (builderTargetField: string) => void;
  builderFilterField: string;
  setBuilderFilterField: (builderFilterField: string) => void;
  builderFilterOperator: CustomWidget["filterOperator"];
  setBuilderFilterOperator: (builderFilterOperator: CustomWidget["filterOperator"]) => void;
  builderFilterValue: string;
  setBuilderFilterValue: (builderFilterValue: string) => void;
  children?: React.ReactNode;
}

export function WidgetBuilderMetricOptions({
  builderCollection,
  setBuilderCollection,
  builderOperation,
  setBuilderOperation,
  builderTargetField,
  setBuilderTargetField,
  builderFilterField,
  setBuilderFilterField,
  builderFilterOperator,
  setBuilderFilterOperator,
  builderFilterValue,
  setBuilderFilterValue,
  children,
}: WidgetBuilderMetricOptionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <Field label={t("reports.widgets.builder.dataCollection")} id="wbm-collection">
        <FormSelect
          id="wbm-collection"
          value={builderCollection}
          onChange={(val: any) => setBuilderCollection(val as CustomWidget["collection"])}
          options={COLLECTION_OPTIONS.map((collectionOption: any) => ({
            value: collectionOption.value,
            label: getCollectionLabel(collectionOption.value, collectionOption.label, t),
          }))}
        />
      </Field>

      <Field label={t("reports.widgets.builder.calcFormula")} id="wbm-formula">
        <FormSelect
          id="wbm-formula"
          value={builderOperation}
          onChange={(val: any) => setBuilderOperation(val as CustomWidget["operation"])}
          options={[
            { value: "count", label: t("reports.widgets.builder.formulaCount") },
            { value: "percentage", label: t("reports.widgets.builder.formulaPercentage") },
            { value: "sum", label: t("reports.widgets.builder.formulaSum") },
            { value: "avg", label: t("reports.widgets.builder.formulaAvg") },
          ]}
        />
      </Field>

      <Field
        label={`${t("reports.widgets.builder.targetField")} ${["count", "percentage"].includes(builderOperation) ? t("reports.widgets.builder.deactivated") : ""}`.trim()}
        id="wbm-target-field"
      >
        <FormSelect
          id="wbm-target-field"
          disabled={["count", "percentage"].includes(builderOperation)}
          value={builderTargetField}
          onChange={setBuilderTargetField}
          options={
            METADATA_FIELDS[builderCollection].numericFields.length === 0
              ? [{ value: "", label: t("reports.widgets.builder.noNumericFields") }]
              : METADATA_FIELDS[builderCollection].numericFields.map((numericField: any) => ({
                  value: numericField.value,
                  label: getFieldLabel(numericField.value, numericField.label, t),
                }))
          }
        />
      </Field>

      <Field label={t("reports.widgets.builder.filterField")} id="wbm-filter-field">
        <FormSelect
          id="wbm-filter-field"
          value={builderFilterField}
          onChange={setBuilderFilterField}
          options={[
            { value: "", label: t("reports.widgets.builder.noFilter") },
            ...METADATA_FIELDS[builderCollection].fields.map((metadataField: any) => ({
              value: metadataField.value,
              label: getFieldLabel(metadataField.value, metadataField.label, t),
            })),
          ]}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label={t("reports.widgets.builder.operator")} id="wbm-operator">
          <FormSelect
            id="wbm-operator"
            disabled={!builderFilterField}
            value={builderFilterOperator ?? ""}
            onChange={(val: any) => setBuilderFilterOperator(val as CustomWidget["filterOperator"])}
            options={[
              { value: "equals", label: t("reports.widgets.builder.opEquals") },
              { value: "contains", label: t("reports.widgets.builder.opContains") },
              { value: "gt", label: `> ${t("reports.widgets.builder.opGt")}` },
              { value: "lt", label: `< ${t("reports.widgets.builder.opLt")}` },
            ]}
          />
        </Field>
        <Field label={t("reports.widgets.builder.matchValue")} id="wbm-match-value">
          <Input
            id="wbm-match-value"
            type="text"
            disabled={!builderFilterField}
            value={builderFilterValue}
            onChange={(event: any) => setBuilderFilterValue(event.target.value)}
            placeholder={t("reports.widgets.builder.placeholderValue")}
            className={`${FORM_INPUT_BUILDER} disabled:opacity-40 disabled:cursor-not-allowed`}
          />
        </Field>
      </div>

      {children}
    </>
  );
}
