import React, { useState } from "react";
import { calculateSmsSegments, type Message } from "@mms/shared";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { Button } from "@/components/ui/button";
import { Check, Copy, Mail } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { SEMANTIC_BG, SEMANTIC_TEXT } from "@/lib/ui/semanticTone";

export interface MessagingDetailBodyCardProps {
  log: Message;
}

export function MessagingDetailBodyCard({ log }: MessagingDetailBodyCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const [copiedBody, setCopiedBody] = useState(false);

  const isSms = log.channel === "sms";
  const smsStats = isSms ? calculateSmsSegments(log.body) : null;

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
      notify.success(t("contacts.table.copied"));
    } catch {
      notify.error(t("messaging.loadFailedHint"));
    }
  };

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
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2.5 text-xs gap-1.5 ${SEMANTIC_TEXT.primary} hover:bg-primary/10`}
            onClick={() => void copyToClipboard(log.body)}
          >
            {copiedBody ? (
              <Check className={`h-3.5 w-3.5 ${SEMANTIC_TEXT.success}`} />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copiedBody ? t("contacts.table.copied") : t("contacts.table.copy")}</span>
          </Button>
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
