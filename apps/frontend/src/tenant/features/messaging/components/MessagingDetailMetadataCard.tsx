import React from "react";
import { formatDateTime, type Message } from "@mms/shared";
import { DetailSectionCard } from "@/components/ui/DetailSectionCard";
import { DetailAttributeRow } from "@/components/ui/DetailAttributeRow";
import { AlertCircle, Check, Copy, MessageCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export interface MessagingDetailMetadataCardProps {
  log: Message;
}

export function MessagingDetailMetadataCard({
  log,
}: MessagingDetailMetadataCardProps): React.JSX.Element {
  const { t } = useTranslation();

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
        value={<span className="capitalize">{log.channel}</span>}
      />
      <DetailAttributeRow
        variant="inset"
        icon={AlertCircle}
        label={t("messaging.category")}
        value={
          <span className="capitalize">{log.category || t("messaging.category.general")}</span>
        }
      />
      <DetailAttributeRow
        variant="inset"
        icon={Check}
        label={t("common.status")}
        value={<span className="capitalize">{log.status || "sent"}</span>}
      />
      <DetailAttributeRow
        variant="inset"
        icon={Copy}
        label={t("messaging.dateSent")}
        value={<span className="font-mono">{formatDateTime(log.sentAt)}</span>}
      />
    </DetailSectionCard>
  );
}
