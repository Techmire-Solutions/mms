import React from "react";
import { calculateSmsSegments, type Message } from "@mms/shared";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { CopyBtn } from "@/components/app/CopyButton";
import { Mail } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_BG, SEMANTIC_TEXT } from "@/lib/ui/semanticTone";

export interface MessagingDetailBodyCardProps {
  log: Message;
}

export function MessagingDetailBodyCard({ log }: MessagingDetailBodyCardProps): React.JSX.Element {
  const { t } = useTranslation();

  const isSms = log.channel === "sms";
  const smsStats = isSms ? calculateSmsSegments(log.body) : null;

  return (
    <DetailSectionCard
      title={t("messaging.messageBody")}
      accentColor="info"
      className="p-0 overflow-hidden divide-y divide-border/50"
    >
      {log.subject && (
        <DetailAttributeRow
          variant="inset"
          icon={Mail}
          label={t("messaging.subjectLabel")}
          value={log.subject}
        />
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-3xs font-mono text-muted-foreground">
            {smsStats
              ? t("messaging.smsSegmentStats", {
                  segments: smsStats.totalSegments,
                  remaining: smsStats.remainingInSegment,
                })
              : `${log.body.length} chars`}
          </span>
          <CopyBtn
            text={log.body}
            showToast
            label={t("common.copy")}
            labelCopied={t("common.copied")}
            variant="ghost"
            className={`h-7 touch-target-coarse px-2.5 text-xs gap-1.5 ${SEMANTIC_TEXT.primary} hover:bg-primary/10`}
          />
        </div>
        <div
          className={`whitespace-pre-wrap rounded bg-background/80 p-3 font-sans text-xs text-foreground border border-border/40 leading-relaxed max-h-60 overflow-y-auto selection:${SEMANTIC_BG.primary}`}
        >
          {log.body}
        </div>
      </div>
    </DetailSectionCard>
  );
}
