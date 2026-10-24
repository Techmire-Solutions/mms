import { AlertCircle } from "lucide-react";
import {
  calculateSmsSegments,
  listNonGsmCharacters,
  personalizeMessage,
  SMS_HIGH_SEGMENT_WARN,
  SMS_MULTI_SEGMENT_WARN,
  SMS_SOFT_CHAR_WARN,
  type SmsSegmentResult,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import type { ValidatedMessagingRecipient } from "./useMessageComposerDispatch";

interface MessageComposerSmsCostFooterProps {
  message: string;
  previewRecipient?: ValidatedMessagingRecipient;
  personalizeOptions: { madrasaName?: string };
}

function costSeverity(stats: SmsSegmentResult): "ok" | "warn" | "high" {
  if (stats.totalSegments >= SMS_HIGH_SEGMENT_WARN || stats.charCount > SMS_SOFT_CHAR_WARN) {
    return "high";
  }
  if (stats.totalSegments >= SMS_MULTI_SEGMENT_WARN) {
    return "warn";
  }
  return "ok";
}

/** Live SMS segment / encoding footer based on personalized preview text. */
export function MessageComposerSmsCostFooter({
  message,
  previewRecipient,
  personalizeOptions,
}: MessageComposerSmsCostFooterProps): React.JSX.Element {
  const { t } = useTranslation();
  const costText = previewRecipient
    ? personalizeMessage(message, previewRecipient, personalizeOptions)
    : message;
  const smsStats = calculateSmsSegments(costText);
  const severity = costSeverity(smsStats);
  const nonGsm = smsStats.isUnicode ? listNonGsmCharacters(costText) : [];

  return (
    <div className="mt-1 space-y-1" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-end gap-2 font-mono text-xs text-muted-foreground">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-bold uppercase ${
            smsStats.isUnicode || severity !== "ok"
              ? "border border-warning/30 bg-warning/15 text-warning"
              : "bg-muted text-foreground"
          }`}
        >
          {smsStats.isUnicode ? t("messaging.encodingUnicode") : t("messaging.encodingGsm")}
          {" • "}
          {t("messaging.smsSegmentStats", {
            segments: smsStats.totalSegments,
            remaining: smsStats.remainingInSegment,
          })}
        </span>
        <span className="shrink-0">
          {smsStats.charCount} {t("messaging.chars")}
          {previewRecipient ? ` · ${t("messaging.smsCostPersonalized")}` : null}
        </span>
      </div>
      {smsStats.isUnicode ? (
        <p className="flex items-start gap-1 text-xs font-medium text-warning">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            {t("messaging.unicodeWarning")}
            {nonGsm.length > 0
              ? ` ${t("messaging.nonGsmCharsHint", { chars: nonGsm.join(" ") })}`
              : null}
          </span>
        </p>
      ) : null}
      {severity === "warn" ? (
        <p className="text-xs font-medium text-warning">{t("messaging.smsMultiSegmentWarn")}</p>
      ) : null}
      {severity === "high" ? (
        <p className="text-xs font-medium text-destructive">{t("messaging.smsHighCostWarn")}</p>
      ) : null}
    </div>
  );
}
