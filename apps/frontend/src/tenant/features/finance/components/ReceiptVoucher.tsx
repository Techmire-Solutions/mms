import React from "react";
import { ReceiptText } from "lucide-react";
import type { Invoice } from "@/lib/data/financeData";
import { useTranslation } from "@/hooks/useTranslation";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import {
  formatDate,
  getCollectedAmountForInvoice,
  getOutstandingAmountForInvoice,
} from "@mms/shared";
import { cn } from "@/lib/utils";
import { formatDocumentAmount } from "@/tenant/features/finance/lib/documentAmount";

export interface ReceiptVoucherProps {
  invoice: Invoice;
  madrasaName: string;
}

function ReceiptRow({
  label,
  value,
  highlight,
  neg,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  neg?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 text-sm",
        highlight && "bg-primary/5",
      )}
    >
      <span className={cn("text-muted-foreground", highlight && "font-semibold text-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "font-semibold",
          highlight ? "text-primary" : neg ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SignatureBlock({ label }: { label: string }) {
  return (
    <div className="space-y-2">
      <div className="h-12 border-b border-dashed border-border" aria-hidden />
      <p className="text-xs text-muted-foreground text-center">{label}</p>
    </div>
  );
}

export function ReceiptVoucher({ invoice, madrasaName }: ReceiptVoucherProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();
  const collected = getCollectedAmountForInvoice(invoice);
  const outstanding = getOutstandingAmountForInvoice(invoice);

  return (
    <div className="receipt-voucher print:break-after-page border border-border rounded-xl p-6 space-y-5 bg-card text-card-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">{madrasaName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("finance.receipt.officialReceipt")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
          <ReceiptText className="w-5 h-5 text-primary" />
          <span className="text-xs font-semibold text-primary">{t("finance.receipt.title")}</span>
        </div>
      </div>

      {/* Voucher meta */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-muted-foreground">{t("finance.receipt.voucherNo")}: </span>
          <span className="font-semibold text-foreground">{invoice.id}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t("finance.receipt.dateIssued")}: </span>
          <span className="font-semibold text-foreground">
            {formatDate(invoice.paidDate ?? invoice.dueDate)}
          </span>
        </div>
      </div>

      {/* Student info */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
          {t("finance.receipt.studentInfo")}
        </p>
        <p className="font-bold text-foreground">{invoice.studentName}</p>
        <p className="text-muted-foreground">
          {invoice.class} · {invoice.session}
        </p>
      </div>

      {/* Fee summary */}
      <div className="space-y-2">
        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
          {t("finance.receipt.feeSummary")}
        </p>
        <div className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
          <ReceiptRow
            label={t("finance.columns.baseFee")}
            value={formatCurrency(invoice.baseFee)}
          />
          {invoice.discountAmt > 0 && (
            <ReceiptRow
              label={t("finance.detail.discount", {
                type: invoice.discountType ?? "",
                value: invoice.discountValue ?? 0,
              })}
              value={`- ${formatCurrency(invoice.discountAmt)}`}
              neg
            />
          )}
          <ReceiptRow
            label={t("finance.form.finalAmount")}
            value={formatDocumentAmount(invoice, invoice.finalAmt, formatCurrency)}
            highlight
          />
          {collected > 0 && (
            <ReceiptRow label={t("finance.detail.amountPaid")} value={formatCurrency(collected)} />
          )}
          {outstanding > 0 && (
            <ReceiptRow label={t("finance.balanceDue")} value={formatCurrency(outstanding)} neg />
          )}
        </div>
      </div>

      {/* Payment details */}
      {(invoice.paidDate ?? invoice.method) && (
        <div className="space-y-2">
          <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
            {t("finance.receipt.paymentDetails")}
          </p>
          <div className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
            {invoice.paidDate && (
              <ReceiptRow
                label={t("finance.detail.due", { date: "" }).replace(": ", "")}
                value={formatDate(invoice.paidDate)}
              />
            )}
            {invoice.method && (
              <ReceiptRow label={t("finance.columns.method")} value={invoice.method} />
            )}
          </div>
        </div>
      )}

      {/* Signature strip */}
      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border">
        <SignatureBlock label={t("finance.receipt.authorizedSignature")} />
        <SignatureBlock label={t("finance.receipt.parentSignature")} />
      </div>
    </div>
  );
}
