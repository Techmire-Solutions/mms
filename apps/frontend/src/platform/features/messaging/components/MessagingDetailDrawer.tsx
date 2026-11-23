import React from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { Badge, Button } from "@shared/ui";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import type { AppTranslationKey, PlatformMessageDto } from "@mms/shared";
import { PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS } from "@/platform/features/messaging/lib/platformMessagingChannels";

const STATUS_LABEL_KEYS: Record<PlatformMessageDto["status"], AppTranslationKey> = {
  queued: "platform.messaging.status.queued",
  sending: "platform.messaging.status.sending",
  sent: "platform.messaging.status.sent",
  delivered: "platform.messaging.status.delivered",
  failed: "platform.messaging.status.failed",
};

/** Read-only message detail drawer with a delete action. */
export function MessagingDetailDrawer({
  message,
  onClose,
  onDelete,
}: {
  message: PlatformMessageDto;
  onClose: () => void;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  const fields: Array<[string, string]> = [
    [t("platform.messaging.channel"), t(PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS[message.channel])],
    [t("platform.messaging.status"), t(STATUS_LABEL_KEYS[message.status])],
    [t("platform.messaging.recipients"), String(message.recipientSnapshot.length)],
    [t("platform.messaging.createdAt"), message.createdAt],
    [t("platform.messaging.scheduledAt"), message.scheduledAt ?? "—"],
    [t("platform.messaging.sentAt"), message.sentAt ?? "—"],
  ];

  return (
    <DetailDrawerShell
      open
      onClose={onClose}
      title={message.subject ?? message.channel}
      subtitle={t("platform.messaging.log")}
      badge={
        <Badge tone="muted" size="sm">
          {t(STATUS_LABEL_KEYS[message.status])}
        </Badge>
      }
      icon={MessageSquare}
      ariaLabel={message.subject ?? message.channel}
      headerActions={
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          className="text-destructive"
          onClick={() => onDelete(message.id)}
        >
          {t("common.delete")}
        </Button>
      }
    >
      <SectionCard title={t("platform.messaging.body")} icon={MessageSquare}>
        <p className="whitespace-pre-wrap text-sm text-foreground">{message.body}</p>
      </SectionCard>

      <SectionCard title={t("platform.messaging.recipients")} icon={MessageSquare}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="space-y-1">
              <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
              <dd className="text-sm text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
    </DetailDrawerShell>
  );
}
