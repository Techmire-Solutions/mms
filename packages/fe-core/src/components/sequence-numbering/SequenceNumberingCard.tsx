import React, { useMemo, useState } from "react";
import { useTranslation } from "../../i18n/index.js";
import { Hash } from "lucide-react";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@mms/ui";
import { Input } from "@mms/ui";
import { ToggleRow } from "@mms/ui";
import { Field } from "../FormPrimitives.js";
import { FormSelect } from "../FormSelect.js";
import { SectionCard } from "@mms/ui";
import {
  formatDeterministicSequence,
  buildSequenceFormulaTemplate,
  type SequenceNumberingConfig,
  type SequenceRolloverPolicy,
  type SequenceYearFormat,
} from "@mms/contracts";
import { SequenceNumberingPreview } from "./SequenceNumberingPreview";
import { SequenceNumberingParametersGrid } from "./SequenceNumberingParametersGrid";
import { SequenceNumberingTelemetry } from "./SequenceNumberingTelemetry";

export interface SequenceNumberingCardProps {
  title: string;
  entityLabel: string;
  config: SequenceNumberingConfig;
  onChange: (nextConfig: SequenceNumberingConfig) => void;
  allowYearless?: boolean;
  allowFiscalRollover?: boolean;
  defaultPrefixPlaceholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  autoGenerateLabel?: string;
  previewLabel?: string;
  templateLabel?: string;
  prefixLabel?: string;
  prefixHint?: string;
  digitsLabel?: string;
  digitsHint?: string;
  startSeqLabel?: string;
  startSeqHint?: string;
  telemetryLabel?: string;
  footer?: React.ReactNode;
}

export function SequenceNumberingCard({
  title,
  entityLabel,
  config,
  onChange,
  allowYearless = false,
  allowFiscalRollover = false,
  defaultPrefixPlaceholder,
  icon = Hash,
  className = SETUP_SECTION_CARD_CLASS,
  autoGenerateLabel,
  previewLabel,
  templateLabel,
  prefixLabel,
  prefixHint,
  digitsLabel,
  digitsHint,
  startSeqLabel,
  startSeqHint,
  telemetryLabel,
  footer,
}: SequenceNumberingCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [startText, setStartText] = useState(String(config.startingSequence));
  const [startError, setStartError] = useState<string | undefined>();

  // Follow externally applied config changes (reset/preset/other card edits) so the
  // draft never drifts from the committed starting sequence. Adjusted during render
  // per React's documented prop-change pattern.
  const [previousStartingSequence, setPreviousStartingSequence] = useState(config.startingSequence);
  if (previousStartingSequence !== config.startingSequence) {
    setPreviousStartingSequence(config.startingSequence);
    setStartText(String(config.startingSequence));
    setStartError(undefined);
  }

  const livePreview = useMemo(() => {
    const currentSeq = config.currentSequence ?? 0;
    const seq = currentSeq > 0 ? currentSeq + 1 : config.startingSequence;
    return formatDeterministicSequence(seq, config);
  }, [config]);

  const formulaTemplate = useMemo(() => buildSequenceFormulaTemplate(config), [config]);

  const updateField = <K extends keyof SequenceNumberingConfig>(
    field: K,
    val: SequenceNumberingConfig[K],
  ) => {
    onChange({ ...config, [field]: val });
  };

  const rolloverOptions = [
    { value: "never", label: t("common.sequenceNumbering.rolloverNever") },
    { value: "monthly", label: t("common.sequenceNumbering.rolloverMonthly") },
    { value: "annual_calendar", label: t("common.sequenceNumbering.rolloverAnnually") },
    ...(allowFiscalRollover
      ? [{ value: "annual_fiscal", label: t("common.sequenceNumbering.rolloverFiscal") }]
      : []),
  ];
  const prefixPlaceholder = defaultPrefixPlaceholder
    ? t("common.sequenceNumbering.prefixPlaceholder", { example: defaultPrefixPlaceholder })
    : undefined;

  return (
    <SectionCard title={title} icon={icon} accentColor="primary" className={className}>
      <div className="space-y-4">
        <ToggleRow
          label={
            autoGenerateLabel ?? t("common.sequenceNumbering.autoGenerate", { entity: entityLabel })
          }
          value={config.autoGenerate}
          onChange={(value) => updateField("autoGenerate", value)}
        />

        {config.autoGenerate ? (
          <>
            <SequenceNumberingPreview
              livePreview={livePreview}
              formulaTemplate={formulaTemplate}
              previewLabel={previewLabel}
              templateLabel={templateLabel}
            />

            <SequenceNumberingParametersGrid
              prefix={config.prefix}
              yearFormat={config.yearFormat}
              sequenceDigits={config.sequenceDigits}
              delimiter={config.delimiter}
              currentYear={currentYear}
              allowYearless={allowYearless}
              prefixLabel={prefixLabel}
              prefixHint={prefixHint}
              prefixPlaceholder={prefixPlaceholder}
              digitsLabel={digitsLabel}
              digitsHint={digitsHint}
              onChangePrefix={(val) => updateField("prefix", val)}
              onChangeYearFormat={(val: SequenceYearFormat) => updateField("yearFormat", val)}
              onChangeDigits={(val) => updateField("sequenceDigits", val)}
              onChangeDelimiter={(val) => updateField("delimiter", val)}
            />

            <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
              <Field
                label={startSeqLabel ?? t("common.sequenceNumbering.startLabel")}
                hint={startSeqHint ?? t("common.sequenceNumbering.startHint")}
                id="sequence-startSeq"
                error={startError}
              >
                <Input
                  id="sequence-startSeq"
                  name="sequence-startSeq"
                  type="text"
                  inputMode="numeric"
                  className={FORM_INPUT}
                  value={startText}
                  onChange={(event) => {
                    const next = event.target.value;
                    setStartText(next);
                    const parsed = Number(next);
                    if (!Number.isFinite(parsed) || parsed < 1) {
                      setStartError(t("common.sequenceNumbering.startMinError"));
                      return;
                    }
                    setStartError(undefined);
                    updateField("startingSequence", Math.floor(parsed));
                  }}
                />
              </Field>

              <SequenceNumberingTelemetry
                currentCounter={config.currentSequence ?? 0}
                rolloverYear={config.lastRolloverYear ?? currentYear}
                telemetryLabel={telemetryLabel}
              />
            </div>

            <div className="border-t border-border/40 pt-2">
              <Field label={t("common.sequenceNumbering.rolloverLabel")} id="sequence-rollover">
                <FormSelect
                  id="sequence-rollover"
                  name="sequence-rollover"
                  value={config.rolloverPolicy}
                  onChange={(val) => updateField("rolloverPolicy", val as SequenceRolloverPolicy)}
                  options={rolloverOptions}
                />
              </Field>
            </div>
          </>
        ) : null}
        {footer}
      </div>
    </SectionCard>
  );
}
