import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/ui/FormSelect";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useTranslation } from "@/hooks/useTranslation";

interface WidgetBuilderThresholdOptionsProps {
  thresholdEnabled: boolean;
  setThresholdEnabled: (thresholdEnabled: boolean) => void;
  thresholdCondition: "lt" | "gt" | "equals";
  setThresholdCondition: (thresholdCondition: "lt" | "gt" | "equals") => void;
  thresholdValue: string;
  setThresholdValue: (thresholdValue: string) => void;
  thresholdColor: "red" | "amber" | "yellow";
  setThresholdColor: (thresholdColor: "red" | "amber" | "yellow") => void;
}

export function WidgetBuilderThresholdOptions({
  thresholdEnabled,
  setThresholdEnabled,
  thresholdCondition,
  setThresholdCondition,
  thresholdValue,
  setThresholdValue,
  thresholdColor,
  setThresholdColor,
}: WidgetBuilderThresholdOptionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="p-4 rounded-2xl border border-border bg-card/20 space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="threshold-enabled"
          checked={thresholdEnabled}
          onCheckedChange={(checked) => setThresholdEnabled(Boolean(checked))}
        />
        <label
          htmlFor="threshold-enabled"
          className="text-xs font-bold text-foreground cursor-pointer select-none"
        >
          {t("reports.widgets.builder.enableThreshold")}
        </label>
      </div>

      {thresholdEnabled && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in text-start">
          <div className="space-y-1">
            <SectionLabel as="label" htmlFor="threshold-condition" weight="bold" tracking="wider">
              {t("reports.widgets.builder.triggerCondition")}
            </SectionLabel>
            <FormSelect
              id="threshold-condition"
              value={thresholdCondition}
              onChange={(value) => setThresholdCondition(value as "lt" | "gt" | "equals")}
              className="w-full text-xs"
              options={[
                { value: "lt", label: `< ${t("reports.widgets.builder.conditionLt")}` },
                { value: "gt", label: `> ${t("reports.widgets.builder.conditionGt")}` },
                { value: "equals", label: `= ${t("reports.widgets.builder.conditionEquals")}` },
              ]}
            />
          </div>
          <div className="space-y-1">
            <SectionLabel as="label" htmlFor="threshold-value" weight="bold" tracking="wider">
              {t("reports.widgets.builder.thresholdValue")}
            </SectionLabel>
            <Input
              id="threshold-value"
              type="text"
              inputMode="decimal"
              value={thresholdValue}
              onChange={(event) => setThresholdValue(event.target.value)}
              placeholder={t("reports.widgets.builder.placeholderThreshold")}
              className="w-full text-xs rounded-lg bg-card/40 text-foreground min-h-11 py-1.5"
            />
          </div>
          <div className="space-y-1">
            <SectionLabel as="label" htmlFor="threshold-color" weight="bold" tracking="wider">
              {t("reports.widgets.builder.alertColor")}
            </SectionLabel>
            <FormSelect
              id="threshold-color"
              value={thresholdColor}
              onChange={(value) => setThresholdColor(value as "red" | "amber" | "yellow")}
              className="w-full text-xs"
              options={[
                { value: "red", label: t("reports.widgets.builder.colorRed") },
                { value: "amber", label: t("reports.widgets.builder.colorAmber") },
                { value: "yellow", label: t("reports.widgets.builder.colorYellow") },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
