import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

export interface SequenceNumberingTelemetryProps {
  currentCounter?: number;
  rolloverYear?: number;
  telemetryLabel?: string;
  counterLabel?: string;
  rolloverLabel?: string;
}

export function SequenceNumberingTelemetry({
  currentCounter = 0,
  rolloverYear,
  telemetryLabel,
  counterLabel,
  rolloverLabel,
}: SequenceNumberingTelemetryProps): React.JSX.Element {
  const { t } = useTranslation();
  const title = telemetryLabel ?? t("common.sequenceNumbering.lastIssued");
  const counter = counterLabel ?? t("common.sequenceNumbering.counter");
  const rollover = rolloverLabel ?? t("common.sequenceNumbering.rolloverYear");

  return (
    <div className="flex h-full min-h-11 flex-col justify-center rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <span className="text-xs font-medium text-foreground">{title}</span>
      <dl className="mt-2 grid grid-cols-[auto_auto] items-center justify-start gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">{counter}</dt>
        <dd className="font-mono font-semibold tabular-nums text-foreground">{currentCounter}</dd>
        {rolloverYear !== undefined ? (
          <>
            <dt className="text-muted-foreground">{rollover}</dt>
            <dd className="font-mono font-semibold tabular-nums text-foreground">{rolloverYear}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
