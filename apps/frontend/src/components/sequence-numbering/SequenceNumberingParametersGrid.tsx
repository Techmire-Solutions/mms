import React, { useEffect, useState } from "react";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/app/FormSelect";
import { Field } from "@/components/app/FormPrimitives";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { SEQUENCE_DELIMITER_PRESETS, type SequenceYearFormat } from "@mms/shared";

const DELIMITER_LABEL_KEYS = {
  "": "common.sequenceNumbering.delimiterNone",
  "-": "common.sequenceNumbering.delimiterHyphen",
  "/": "common.sequenceNumbering.delimiterSlash",
  ".": "common.sequenceNumbering.delimiterDot",
} as const;

/** Compact chip glyphs — full names live on aria-label via i18n. */
const DELIMITER_SYMBOLS: Record<string, string> = {
  "": "∅",
  "-": "-",
  "/": "/",
  ".": ".",
};

export interface SequenceNumberingParametersGridProps {
  prefix: string;
  yearFormat: SequenceYearFormat;
  sequenceDigits: number;
  delimiter: string;
  currentYear: number;
  allowYearless?: boolean;
  prefixLabel?: string;
  prefixHint?: string;
  prefixPlaceholder?: string;
  yearFormatLabel?: string;
  yearFormatHint?: string;
  digitsLabel?: string;
  digitsHint?: string;
  delimiterLabel?: string;
  delimiterHint?: string;
  onChangePrefix: (val: string) => void;
  onChangeYearFormat: (val: SequenceYearFormat) => void;
  onChangeDigits: (val: number) => void;
  onChangeDelimiter: (val: string) => void;
}

export function SequenceNumberingParametersGrid({
  prefix,
  yearFormat,
  sequenceDigits,
  delimiter,
  currentYear,
  allowYearless = false,
  prefixLabel,
  prefixHint,
  prefixPlaceholder,
  yearFormatLabel,
  yearFormatHint,
  digitsLabel,
  digitsHint,
  delimiterLabel,
  delimiterHint,
  onChangePrefix,
  onChangeYearFormat,
  onChangeDigits,
  onChangeDelimiter,
}: SequenceNumberingParametersGridProps): React.JSX.Element {
  const { t } = useTranslation();
  const [digitsText, setDigitsText] = useState(String(sequenceDigits));
  const [digitsError, setDigitsError] = useState<string | undefined>();

  useEffect(() => {
    setDigitsText(String(sequenceDigits));
    setDigitsError(undefined);
  }, [sequenceDigits]);

  const yearOptions = [
    {
      value: "YYYY",
      label: t("common.sequenceNumbering.yearFormatYYYY", { year: currentYear }),
    },
    {
      value: "YY",
      label: t("common.sequenceNumbering.yearFormatYY", {
        year: String(currentYear).slice(-2),
      }),
    },
  ];
  if (allowYearless) {
    yearOptions.push({
      value: "NONE",
      label: t("common.sequenceNumbering.yearFormatNone"),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field
        label={prefixLabel ?? t("common.sequenceNumbering.prefix")}
        hint={prefixHint ?? t("common.sequenceNumbering.prefixHint")}
        id="sequence-prefix"
      >
        <Input
          id="sequence-prefix"
          name="sequence-prefix"
          className={FORM_INPUT}
          value={prefix}
          onChange={(event) => onChangePrefix(event.target.value.toUpperCase())}
          placeholder={
            prefixPlaceholder ?? t("common.sequenceNumbering.prefixPlaceholder", { example: "ID" })
          }
        />
      </Field>

      <Field
        label={yearFormatLabel ?? t("common.sequenceNumbering.yearFormat")}
        hint={yearFormatHint ?? t("common.sequenceNumbering.yearFormatHint")}
        id="sequence-year-format"
      >
        <FormSelect
          id="sequence-year-format"
          name="sequence-year-format"
          value={yearFormat}
          onChange={(val) => onChangeYearFormat(val as SequenceYearFormat)}
          options={yearOptions}
        />
      </Field>

      <Field
        label={digitsLabel ?? t("common.sequenceNumbering.digits")}
        hint={digitsHint ?? t("common.sequenceNumbering.digitsHint")}
        id="sequence-digits"
        error={digitsError}
      >
        <Input
          id="sequence-digits"
          name="sequence-digits"
          type="text"
          inputMode="numeric"
          className={FORM_INPUT}
          value={digitsText}
          onChange={(event) => {
            const next = event.target.value;
            setDigitsText(next);
            const parsed = Number(next);
            if (!Number.isFinite(parsed) || parsed < 2 || parsed > 8) {
              setDigitsError(t("common.sequenceNumbering.digitsRangeError"));
              return;
            }
            setDigitsError(undefined);
            onChangeDigits(parsed);
          }}
        />
      </Field>

      <Field
        label={delimiterLabel ?? t("common.sequenceNumbering.delimiter")}
        hint={delimiterHint ?? t("common.sequenceNumbering.delimiterHint")}
        id="sequence-delimiter"
      >
        <div
          id="sequence-delimiter"
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={t("common.sequenceNumbering.delimiter")}
        >
          {SEQUENCE_DELIMITER_PRESETS.map((preset) => {
            const labelKey =
              DELIMITER_LABEL_KEYS[preset.value as keyof typeof DELIMITER_LABEL_KEYS];
            const label = labelKey ? t(labelKey) : preset.label;
            const symbol = DELIMITER_SYMBOLS[preset.value] ?? preset.label;
            const selected = delimiter === preset.value;
            return (
              <Button
                key={preset.label}
                type="button"
                variant={selected ? "default" : "outline"}
                size="icon"
                onClick={() => onChangeDelimiter(preset.value)}
                aria-pressed={selected}
                aria-label={label}
                className={cn(
                  "font-mono text-sm",
                  !selected && "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                {symbol}
              </Button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}
