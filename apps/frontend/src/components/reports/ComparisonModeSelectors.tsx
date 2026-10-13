import React from "react";
import { DateRangeFilterBar } from "@/components/app/DateRangeFilterBar";
import { FormSelect } from "@/components/app/FormSelect";
import { SectionLabel } from "@/components/app/SectionLabel";
import { useTranslation } from "@/hooks/useTranslation";
import type { DateRange } from "./comparisonModeTypes";

interface ComparisonModeSelectorsProps {
  mode: "sessions" | "daterange";
  isContacts: boolean;
  valA: string;
  valB: string;
  setValA: (value: string) => void;
  setValB: (value: string) => void;
  rangeA: DateRange;
  rangeB: DateRange;
  setRangeA: React.Dispatch<React.SetStateAction<DateRange>>;
  setRangeB: React.Dispatch<React.SetStateAction<DateRange>>;
  options: readonly { id: string; name: string }[];
}

export function ComparisonModeSelectors({
  mode,
  isContacts,
  valA,
  valB,
  setValA,
  setValB,
  rangeA,
  rangeB,
  setRangeA,
  setRangeB,
  options,
}: ComparisonModeSelectorsProps): React.JSX.Element {
  const { t } = useTranslation();

  if (mode === "sessions") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
        {[
          { label: "A", value: valA, setValue: setValA, color: "text-primary" },
          { label: "B", value: valB, setValue: setValB, color: "text-warning" },
        ].map(({ label, value, setValue, color }) => (
          <div key={label} className="flex flex-col gap-1">
            <SectionLabel
              as="label"
              htmlFor={`comparison-session-${label.toLowerCase()}`}
              weight="bold"
              tracking="wide"
              toneClassName={color}
            >
              {isContacts ? t("reports.comparison.stage") : t("reports.comparison.session")} {label}
            </SectionLabel>
            <FormSelect
              id={`comparison-session-${label.toLowerCase()}`}
              value={value}
              onChange={(newValue) => setValue(newValue)}
              options={options.map((option) => ({ value: option.id, label: option.name }))}
              className="w-full"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-start">
      {[
        {
          label: t("reports.comparison.rangeA"),
          range: rangeA,
          setRange: setRangeA,
          color: "text-primary",
          idPrefix: "compare-range-a",
        },
        {
          label: t("reports.comparison.rangeB"),
          range: rangeB,
          setRange: setRangeB,
          color: "text-warning",
          idPrefix: "compare-range-b",
        },
      ].map(({ label, range, setRange, color, idPrefix }) => (
        <div key={label} className="space-y-2">
          <SectionLabel as="p" weight="bold" tracking="wide" toneClassName={color}>
            {label}
          </SectionLabel>
          <DateRangeFilterBar
            idPrefix={idPrefix}
            dateFrom={range.from}
            dateTo={range.to}
            onDateFromChange={(value) =>
              setRange((currentRange) => ({ ...currentRange, from: value }))
            }
            onDateToChange={(value) => setRange((currentRange) => ({ ...currentRange, to: value }))}
            className="gap-2"
            pickerClassName="w-full min-w-0 flex-1 text-sm"
          />
        </div>
      ))}
    </div>
  );
}
