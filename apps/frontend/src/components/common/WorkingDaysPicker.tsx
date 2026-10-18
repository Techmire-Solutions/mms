import React, { useId, useMemo } from "react";
import { WEEKDAY_NAMES, type WeekdayName } from "@mms/shared";
import { FormCheckboxCard } from "@/components/ui/FormCheckboxCard";
import { useTranslation } from "@/hooks/useTranslation";

export interface WorkingDaysPickerProps {
  value: readonly string[];
  onChange: (days: WeekdayName[]) => void;
  /** Accessible group label. */
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Weekly teaching days (Attendance preferences, per-session override); names localized via Intl. */
export function WorkingDaysPicker({ value, onChange, label, description, disabled }: WorkingDaysPickerProps): React.JSX.Element {
  const { language } = useTranslation();
  const baseId = useId();
  const selected = new Set(value.map((day) => day.toLowerCase()));
  const labels = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { weekday: "long", timeZone: "UTC" });
    // 2023-01-01 was a Sunday, matching WEEKDAY_NAMES index 0.
    return WEEKDAY_NAMES.map((_, index) => format.format(Date.UTC(2023, 0, 1 + index)));
  }, [language]);

  const toggle = (day: WeekdayName, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(day);
    else next.delete(day);
    onChange(WEEKDAY_NAMES.filter((name) => next.has(name)));
  };

  return (
    <fieldset className="min-w-0 space-y-2" aria-describedby={description ? `${baseId}-desc` : undefined}>
      <legend className="text-sm font-semibold text-foreground">{label}</legend>
      {description ? <p id={`${baseId}-desc`} className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {WEEKDAY_NAMES.map((day, index) => (
          <FormCheckboxCard
            key={day}
            id={`${baseId}-${day}`}
            name="workingDays"
            checked={selected.has(day)}
            onCheckedChange={(checked) => toggle(day, checked)}
            label={labels[index]}
            disabled={disabled}
          />
        ))}
      </div>
    </fieldset>
  );
}
