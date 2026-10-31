import type { ReactNode } from "react";
import { formatDate } from "@mms/shared";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { DateText } from "@/components/app/DateText";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { Invoice } from "@/lib/data/financeData";
import { formatDocumentAmount } from "@/tenant/features/finance/lib/documentAmount";

/** Render a Finance invoice Work column value (non-face columns). */
export function renderInvoiceWorkColumnValue(
  invoice: Invoice,
  columnKey: string,
  options: {
    t: TranslationFunction;
    statusConfig: Record<string, StatusBadgeConfigItem>;
    formatCurrency: (value: number) => string;
    /** Replacement shown for empty values. */
    emptyFallback?: ReactNode;
  },
): ReactNode {
  const { t, statusConfig, formatCurrency, emptyFallback } = options;

  switch (columnKey) {
    case "invoice":
      return (
        <span className="text-xs font-mono font-semibold text-muted-foreground">
          {invoice.invoiceNumber ?? invoice.id}
        </span>
      );
    case "student":
      return <span className="text-sm font-semibold text-foreground">{invoice.studentName}</span>;
    case "sessionClass":
      return (
        <div>
          <p className="m-0 text-sm text-foreground">{invoice.class}</p>
          <p className="m-0 text-xs text-muted-foreground">{invoice.session}</p>
        </div>
      );
    case "baseFee":
      return (
        <span className="text-sm text-foreground">
          {formatDocumentAmount(invoice, invoice.baseFee, formatCurrency)}
        </span>
      );
    case "discount":
      return invoice.discountAmt > 0 ? (
        <div>
          <span className="text-sm font-medium text-warning">
            -{formatDocumentAmount(invoice, invoice.discountAmt, formatCurrency)}
          </span>
          <p className="m-0 text-xs text-muted-foreground">{invoice.discountType}</p>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      );
    case "final":
      return (
        <>
          <span className="text-sm font-bold text-foreground">
            {formatDocumentAmount(invoice, invoice.finalAmt, formatCurrency)}
          </span>
          {invoice.paidAmt !== undefined && invoice.status === "partial" && (
            <p className="m-0 text-xs text-info">
              {t("finance.paidAmount", {
                amount: formatDocumentAmount(invoice, invoice.paidAmt, formatCurrency),
              })}
            </p>
          )}
        </>
      );
    case "status":
      return <StatusBadge status={invoice.status} config={statusConfig} size="sm" />;
    case "dueDate":
      return (
        <span
          className={`text-sm ${invoice.status === "overdue" ? "font-semibold text-destructive" : "text-muted-foreground"}`}
        >
          <DateText>{formatDate(invoice.dueDate)}</DateText>
        </span>
      );
    default:
      return emptyFallback;
  }
}
