import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Hash } from "lucide-react";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { ToggleRow } from "@/components/app/ToggleRow";
import { Field } from "@/components/app/FormPrimitives";
import { SectionCard } from "@/components/app/SectionCard";
import {
  formatDeterministicSequence,
  buildSequenceFormulaTemplate,
  type SequenceNumberingConfig,
  type SequenceYearFormat,
} from "@mms/shared";
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
  restartLabel?: string;
  restartDesc?: string;
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
  restartLabel,
  restartDesc,
  footer,
}: SequenceNumberingCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [startText, setStartText] = useState(String(config.startingSequence));
  const [startError, setStartError] = useState<string | undefined>();

  useEffect(() => {
    setStartText(String(config.startingSequence));
    setStartError(undefined);
  }, [config.startingSequence]);

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

  const isAnnualReset = config.rolloverPolicy !== "never";
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
              <ToggleRow
                label={
                  restartLabel ??
                  t(
                    allowFiscalRollover
                      ? "common.sequenceNumbering.restartFiscal"
                      : "common.sequenceNumbering.restartAnnually",
                  )
                }
                description={
                  restartDesc ??
                  t(
                    allowFiscalRollover
                      ? "common.sequenceNumbering.restartFiscalDesc"
                      : "common.sequenceNumbering.restartAnnuallyDesc",
                    { entity: entityLabel },
                  )
                }
                value={isAnnualReset}
                onChange={(enabled) =>
                  updateField(
                    "rolloverPolicy",
                    enabled ? (allowFiscalRollover ? "annual_fiscal" : "annual_calendar") : "never",
                  )
                }
              />
            </div>
          </>
        ) : null}
        {footer}
      </div>
    </SectionCard>
  );
}
