import React from "react";
import { Banknote } from "lucide-react";
import type { Payment } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Drawer } from "@/components/app/Drawer";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/app/DetailDrawerArchiveChrome";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";

export interface PaymentDetailProps {
  payment: Payment;
  onClose: () => void;
  onEdit?: (payment: Payment) => void;
  canDelete?: boolean;
  onRestore?: (id: string) => void | Promise<void>;
}

export const PaymentDetail = function PaymentDetail({
  payment,
  onClose,
  onEdit,
  canDelete = false,
  onRestore,
}: PaymentDetailProps): React.JSX.Element {
  const { t } = useTranslation();
  const isArchived = !!payment.deletedAt;

  return (
    <Drawer
      open
      onClose={onClose}
      title={t("finance.payments.detail.title")}
      subtitle={payment.studentName || "Student"}
      icon={Banknote}
      headerExtra={isArchived && <DetailDrawerArchivedBanner deletedAt={payment.deletedAt} />}
      headerActions={
        <DetailDrawerRestoreOrEditAction
          isArchived={isArchived}
          canEdit={!!onEdit}
          canRestore={canDelete}
          onEdit={() => onEdit?.(payment)}
          onRestore={() => onRestore?.(payment.id)}
          restoreLabel={t("common.restore")}
          editLabel={t("common.edit")}
        />
      }
    >
      <div className="flex flex-col gap-6 py-6">
        <DetailSectionCard
          title={t("finance.payments.detail.overview")}
          className="overflow-hidden divide-y divide-border"
        >
          <DetailAttributeRow
            label={t("finance.fields.payment.invoiceId")}
            value={payment.invoiceId}
          />
          <DetailAttributeRow
            label={t("finance.fields.payment.student")}
            value={payment.studentName}
          />
          <DetailAttributeRow
            label={t("finance.fields.payment.amount")}
            value={payment.amount.toString()}
          />
          <DetailAttributeRow label={t("finance.fields.payment.date")} value={payment.date} />
          <DetailAttributeRow label={t("finance.fields.payment.method")} value={payment.method} />
          <DetailAttributeRow
            label={t("finance.fields.payment.receivedBy")}
            value={payment.receivedBy || "—"}
          />
          <DetailAttributeRow
            label={t("finance.fields.payment.note")}
            value={payment.note || "—"}
          />
        </DetailSectionCard>
      </div>
    </Drawer>
  );
};
