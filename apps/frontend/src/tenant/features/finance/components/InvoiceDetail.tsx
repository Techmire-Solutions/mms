import React from "react";
import { ReceiptText, User, Calendar, CreditCard, Printer } from "lucide-react";
import { type Invoice } from "@/lib/data/financeData";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/app/Drawer";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { cn } from "@/lib/utils";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/app/DetailDrawerArchiveChrome";

import { useTranslation } from "@/hooks/useTranslation";
import { formatDate, getOutstandingAmountForInvoice } from "@mms/shared";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { InvoiceCorrectionActions } from "@/tenant/features/finance/components/InvoiceCorrectionActions";

export interface InvoiceDetailProps {
  invoice: Invoice;
  onClose: () => void;
  onRecord: (invoice: Invoice) => void;
  onPrintReceipt?: (invoice: Invoice) => void;
  canWrite?: boolean;
  canDelete?: boolean;
  onRestore?: (id: string) => void | Promise<void>;
}

/**
 * InvoiceDetail Component
 *
 * Displays detailed information about a specific invoice, including fee breakdown
 * and payment status.
 *
 * @param {InvoiceDetailProps} props - The component props.
 * @returns {React.JSX.Element}
 */
export const InvoiceDetail = function InvoiceDetail({
  invoice,
  onClose,
  onRecord,
  onPrintReceipt,
  canWrite = true,
  canDelete = false,
  onRestore,
}: InvoiceDetailProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();
  const isArchived = Boolean(invoice.deletedAt);

  const statusConfig = (() => ({
    paid: { label: t("finance.invoiceStatus.paid"), cls: SEMANTIC_BADGE.success },
    pending: { label: t("finance.invoiceStatus.pending"), cls: SEMANTIC_BADGE.warning },
    overdue: { label: t("finance.invoiceStatus.overdue"), cls: SEMANTIC_BADGE.destructive },
    partial: { label: t("finance.invoiceStatus.partial"), cls: SEMANTIC_BADGE.info },
    cancelled: { label: t("finance.invoiceStatus.cancelled"), cls: SEMANTIC_BADGE.muted },
  }))() as Record<string, StatusBadgeConfigItem>;

  const outstanding = getOutstandingAmountForInvoice(invoice);
  const rows = (() => [
    {
      label: t("finance.columns.baseFee"),
      value: formatCurrency(invoice.baseFee),
      highlight: false,
      neg: false,
    },
    ...(invoice.discountAmt > 0
      ? [
          {
            label: t("finance.detail.discount", {
              type: invoice.discountType ?? t("common.none"),
              value: invoice.discountValue,
            }),
            value: `– ${formatCurrency(invoice.discountAmt)}`,
            highlight: false,
            neg: true,
          },
        ]
      : []),
    {
      label: t("finance.form.finalAmount"),
      value: formatCurrency(invoice.finalAmt),
      highlight: true,
      neg: false,
    },
    ...(invoice.paidAmt
      ? [
          {
            label: t("finance.detail.amountPaid"),
            value: formatCurrency(invoice.paidAmt),
            highlight: false,
            neg: false,
          },
        ]
      : []),
    ...(invoice.lateFeeAmt
      ? [
          {
            label: t("finance.collect.lateFee"),
            value: formatCurrency(invoice.lateFeeAmt),
            highlight: false,
            neg: false,
          },
        ]
      : []),
    ...(invoice.creditedAmt
      ? [
          {
            label: t("finance.collect.credited"),
            value: `– ${formatCurrency(invoice.creditedAmt)}`,
            highlight: false,
            neg: true,
          },
        ]
      : []),
    ...(outstanding > 0
      ? [
          {
            label: t("finance.balanceDue"),
            value: formatCurrency(outstanding),
            highlight: false,
            neg: true,
          },
        ]
      : []),
  ])();

  const footerNode = (() => (
    <div className="space-y-2">
      {!isArchived && canWrite && invoice.status !== "paid" && invoice.status !== "cancelled" && (
        <Button
          onClick={() => {
            onRecord(invoice);
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <ReceiptText className="w-4 h-4" aria-hidden="true" /> {t("finance.recordPayment")}
        </Button>
      )}
      {onPrintReceipt && (
        <Button
          variant="outline"
          onClick={() => {
            onPrintReceipt(invoice);
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" aria-hidden="true" /> {t("finance.printReceipt")}
        </Button>
      )}
      {!isArchived && canWrite && (
        <InvoiceCorrectionActions invoice={invoice} onCancelled={onClose} />
      )}
    </div>
  ))();

  return (
    <Drawer
      open
      onClose={onClose}
      title={t("finance.detail.title", { id: invoice.id })}
      icon={ReceiptText}
      className="max-w-2xl"
      headerExtra={isArchived && <DetailDrawerArchivedBanner deletedAt={invoice.deletedAt} />}
      headerActions={
        <DetailDrawerRestoreOrEditAction
          isArchived={isArchived}
          canEdit={false}
          canRestore={canDelete}
          onRestore={() => onRestore?.(invoice.id)}
          restoreLabel={t("common.restore")}
          editLabel={t("common.edit")}
        />
      }
      footer={footerNode}
    >
      <div className="space-y-5">
        <div
          className="flex flex-wrap items-center justify-between gap-2"
          aria-label={t("finance.detail.status", {
            status: statusConfig[invoice.status]?.label ?? invoice.status,
          })}
        >
          <StatusBadge status={invoice.status} config={statusConfig} size="sm" />
          <span className="min-w-0 text-xs text-muted-foreground">
            {t("finance.detail.due", { date: formatDate(invoice.dueDate) })}
          </span>
        </div>

        {/* Student & session info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 text-sm">
            <User className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="font-semibold text-foreground">{invoice.studentName}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {invoice.class} · {invoice.session}
            </span>
          </div>
        </div>

        <DetailSectionCard
          title={t("finance.detail.breakdown")}
          className="divide-y divide-border/50 p-0"
        >
          {rows.map((row) => (
            <div
              key={row.label}
              className={cn(
                "flex items-center justify-between px-3 py-2",
                row.highlight ? "bg-primary/5" : "",
              )}
            >
              <span
                className={cn(
                  "text-xs font-bold uppercase leading-none tracking-tight",
                  row.highlight ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {row.label}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold text-end",
                  row.highlight ? "text-primary" : row.neg ? "text-destructive" : "text-foreground",
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </DetailSectionCard>

        {/* Payment info */}
        {invoice.paidDate && (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {t("finance.detail.paidVia", {
                date: formatDate(invoice.paidDate),
                method: invoice.method ?? t("common.none"),
              })}
            </span>
          </div>
        )}
      </div>
    </Drawer>
  );
};
