import React from "react";
import {
  User,
  Users,
  Bookmark,
  Target,
  UserCheck,
  ShieldCheck,
  Coins,
  CreditCard,
  Clock,
} from "lucide-react";
import { formatMoney, formatDate } from "@mms/shared";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  ObligationCollection,
  ObligationType,
  MujtahidRep,
  Mujtahid,
} from "@/lib/data/obligationsData";

interface ObligationCollectionAttributesCardProps {
  collection: ObligationCollection;
  sender: { name?: string } | null | undefined;
  reference: { name?: string } | null | undefined;
  obType: ObligationType | null | undefined;
  rep: MujtahidRep | null | undefined;
  mujtahid: Mujtahid | null | undefined;
  currency: { code?: string } | null | undefined;
  paymentModeConfig: Record<string, StatusBadgeConfigItem>;
  user: { name?: string } | null | undefined;
}

export function ObligationCollectionAttributesCard({
  collection,
  sender,
  reference,
  obType,
  rep,
  mujtahid,
  currency,
  paymentModeConfig,
  user,
}: ObligationCollectionAttributesCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <DetailSectionCard
      title={t("obligations.detail.title")}
      className="divide-y divide-border/50 p-0"
    >
      <DetailAttributeRow
        variant="inset"
        icon={User}
        label={t("obligations.columns.sender")}
        value={sender?.name}
      />
      {reference && (
        <DetailAttributeRow
          variant="inset"
          icon={Users}
          label={t("obligations.form.reference")}
          value={reference?.name}
        />
      )}
      <DetailAttributeRow
        variant="inset"
        icon={Bookmark}
        label={t("obligations.columns.obligationType")}
        value={obType?.name}
      />
      {obType?.designated_for && (
        <DetailAttributeRow
          variant="inset"
          icon={Target}
          label={t("obligations.detail.designatedFor")}
          value={obType.designated_for}
        />
      )}
      <DetailAttributeRow
        variant="inset"
        icon={UserCheck}
        label={t("obligations.form.representative")}
        value={rep?.name}
      />
      <DetailAttributeRow
        variant="inset"
        icon={ShieldCheck}
        label={t("obligations.form.mujtahidLabel")}
        value={mujtahid?.name}
      />
      <DetailAttributeRow
        variant="inset"
        icon={Coins}
        label={t("obligations.columns.amount")}
        value={<span className="font-mono">{formatMoney(collection.amount, currency?.code)}</span>}
      />
      <DetailAttributeRow
        variant="inset"
        icon={CreditCard}
        label={t("obligations.columns.paymentMode")}
        value={
          <StatusBadge status={collection.payment_mode} config={paymentModeConfig} size="sm" />
        }
      />
      <DetailAttributeRow
        variant="inset"
        icon={UserCheck}
        label={t("obligations.form.receivedBy")}
        value={user?.name}
      />
      <DetailAttributeRow
        variant="inset"
        icon={Clock}
        label={t("obligations.detail.created")}
        value={formatDate(collection.created_at)}
      />
    </DetailSectionCard>
  );
}
