import React from "react";
import {
  formatDateTime,
  getMessageCategoryLabelKey,
  type AppTranslationKey,
  type Message,
} from "@mms/shared";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { ChannelBadge } from "@/components/app/ChannelBadge";
import { AlertCircle, Check, Copy, MessageCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export interface MessagingDetailMetadataCardProps {
  log: Message;
}

export function MessagingDetailMetadataCard({
  log,
}: MessagingDetailMetadataCardProps): React.JSX.Element {
  const { t } = useTranslation();

  const categoryKey = log.category
    ? getMessageCategoryLabelKey(log.category)
    : "messaging.category.general";
  const statusKey = `messaging.status.${log.status || "sent"}` as AppTranslationKey;

  return (
    <DetailSectionCard
      title={t("common.details")}
      accentColor="secondary"
      className="p-0 overflow-hidden divide-y divide-border/50"
    >
      <DetailAttributeRow
        variant="inset"
        icon={MessageCircle}
        label={t("messaging.channel")}
        value={<ChannelBadge channel={log.channel} />}
      />
      <DetailAttributeRow
        variant="inset"
        icon={AlertCircle}
        label={t("messaging.category")}
        value={<span className="font-medium text-foreground">{t(categoryKey as AppTranslationKey)}</span>}
      />
      <DetailAttributeRow
        variant="inset"
        icon={Check}
        label={t("common.status")}
        value={<span className="font-medium text-foreground">{t(statusKey)}</span>}
      />
      <DetailAttributeRow
        variant="inset"
        icon={Copy}
        label={t("messaging.dateSent")}
        value={<span className="font-mono text-muted-foreground">{formatDateTime(log.sentAt)}</span>}
      />
    </DetailSectionCard>
  );
}
