import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { calculateSmsSegments, formatDateTime, personalizeMessage } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/app/ChannelBadge";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import type { ValidatedMessagingRecipient } from "./useMessageComposerDispatch";

export interface MessageComposerLivePreviewProps {
  channel: "sms" | "whatsapp" | "email";
  message: string;
  subject: string;
  eligibleRecipients: ValidatedMessagingRecipient[];
  previewIndex: number;
  personalizeOptions: { madrasaName?: string };
  onPreviewIndexChange: (index: number) => void;
}

export function MessageComposerLivePreview({
  channel,
  message,
  subject,
  eligibleRecipients,
  previewIndex,
  personalizeOptions,
  onPreviewIndexChange,
}: MessageComposerLivePreviewProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const isEmail = channel === "email";
  const isSms = channel === "sms";
  const isBulk = eligibleRecipients.length > 1;
  const recipient = eligibleRecipients[previewIndex] || eligibleRecipients[0];
  const previewText =
    message.trim() && recipient ? personalizeMessage(message, recipient, personalizeOptions) : "";
  const smsStats = calculateSmsSegments(previewText);

  if (!previewText || !recipient) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${previewIndex}-${channel}`}
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
        transition={{ duration: reducedMotion ? 0 : 0.15 }}
        className="rounded-xl border border-border/80 bg-muted/20 p-3.5 backdrop-blur-xs"
      >
        <h5 className="mb-2.5 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5 text-foreground">
            <Sparkles
              className={`h-3.5 w-3.5 shrink-0 text-primary ${reducedMotion ? "" : "animate-pulse"}`}
            />
            <span className="min-w-0 truncate">
              {t("messaging.livePreview", { name: recipient.name })}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {isBulk && (
              <div className="flex items-center gap-1.5 text-xs">
                <select
                  aria-label={t("messaging.selectRecipients")}
                  value={previewIndex}
                  onChange={(e) => onPreviewIndexChange(Number(e.target.value))}
                  className="h-7 max-w-36 truncate rounded-md border border-border/60 bg-background/80 px-1.5 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                >
                  {eligibleRecipients.map((r, i) => (
                    <option key={r.id || `${r.name}-${i}`} value={i}>
                      {i + 1}. {r.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11"
                    disabled={previewIndex <= 0}
                    onClick={() => onPreviewIndexChange(Math.max(0, previewIndex - 1))}
                    aria-label={t("common.previous")}
                  >
                    <ChevronLeft className="h-3 w-3 rtl:rotate-180" />
                  </Button>
                  <span className="font-mono text-xs">
                    {previewIndex + 1}/{eligibleRecipients.length}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11"
                    disabled={previewIndex >= eligibleRecipients.length - 1}
                    onClick={() =>
                      onPreviewIndexChange(
                        Math.min(eligibleRecipients.length - 1, previewIndex + 1),
                      )
                    }
                    aria-label={t("common.next")}
                  >
                    <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            )}
            <ChannelBadge channel={channel} className="text-xs" />
          </div>
        </h5>
        {isEmail ? (
          <div className={`${WORK_SURFACE_INNER} space-y-2 p-3 text-xs`}>
            <div className="border-b border-border/50 pb-2 text-xs text-muted-foreground">
              <div>
                <span className="me-1 font-semibold text-foreground">{t("messaging.to")}:</span>
                {recipient.name} &lt;{recipient.email}&gt;
              </div>
              <div className="mt-0.5">
                <span className="me-1 font-semibold text-foreground">
                  {t("messaging.subjectLabel")}:
                </span>
                {personalizeMessage(
                  subject || t("messaging.defaultSubject"),
                  recipient,
                  personalizeOptions,
                )}
              </div>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed text-foreground">{previewText}</div>
          </div>
        ) : isSms ? (
          <div className="max-w-bubble-wide space-y-1 rounded-2xl rounded-ss-none border border-info/20 bg-info/10 p-3 text-xs text-foreground shadow-xs">
            <div className="whitespace-pre-wrap leading-relaxed">{previewText}</div>
            <div className="flex items-center justify-between border-t border-info/10 pt-1 font-mono text-xs opacity-70">
              <span>{recipient.phone}</span>
              <span>
                {t("messaging.smsSegmentBadge", { count: String(smsStats.totalSegments) })}
              </span>
            </div>
          </div>
        ) : (
          <div className="max-w-bubble-wide space-y-1.5 rounded-2xl rounded-ss-none border border-success/20 bg-success/10 p-3 text-xs text-foreground shadow-xs">
            <div className="flex items-center justify-between border-b border-success/15 pb-1 text-xs font-semibold text-success">
              <span>{t("messaging.whatsappBroadcast")}</span>
              <span>{recipient.phone}</span>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{previewText}</div>
            <div className="flex items-center justify-end gap-1 font-mono text-xs text-success">
              <span>{formatDateTime(new Date())}</span>
              <CheckCheck className="h-3.5 w-3.5" />
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
