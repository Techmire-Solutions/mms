import React, { useState } from "react";
import { DollarSign } from "lucide-react";
import { formatDate } from "@mms/shared";
import type { Invoice } from "@/lib/data/financeData";
import { EmptyState } from "@/components/app/EmptyState";
import { ReportDataGridContainer } from "@/components/reports/ReportDataGridContainer";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ModuleTableHeaderCell } from "@/components/app/ModuleTableHeaderCell";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import type { ExportColumn } from "@/components/app/ExportToolbar";

interface FinancialInvoiceTableProps {
  invoices: Invoice[];
}

export const FinancialInvoiceTable = function FinancialInvoiceTable({
  invoices,
}: FinancialInvoiceTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();
  const statusConfig = (() => ({
    paid: { label: t("finance.invoiceStatus.paid"), cls: SEMANTIC_BADGE.success },
    pending: { label: t("finance.invoiceStatus.pending"), cls: SEMANTIC_BADGE.warning },
    overdue: { label: t("finance.invoiceStatus.overdue"), cls: SEMANTIC_BADGE.destructive },
    partial: { label: t("finance.invoiceStatus.partial"), cls: SEMANTIC_BADGE.info },
    cancelled: { label: t("finance.invoiceStatus.cancelled"), cls: SEMANTIC_BADGE.muted },
  }))();
  const headers = (() => [
    { key: "invoice", label: t("finance.columns.invoice"), variant: "text" as const },
    { key: "student", label: t("finance.columns.student"), variant: "text" as const },
    { key: "class", label: t("finance.report.classColumn"), variant: "text" as const },
    { key: "baseFee", label: t("finance.columns.baseFee"), variant: "currency" as const },
    { key: "discount", label: t("finance.columns.discount"), variant: "currency" as const },
    { key: "final", label: t("finance.columns.final"), variant: "currency" as const },
    { key: "dueDate", label: t("finance.columns.dueDate"), variant: "text" as const },
    { key: "status", label: t("finance.columns.status"), variant: "badge" as const },
  ])();

  const exportColumns = (() => [
    { key: "invoice", header: t("finance.columns.invoice") },
    { key: "student", header: t("finance.columns.student") },
    { key: "class", header: t("finance.report.classColumn") },
    { key: "baseFee", header: t("finance.columns.baseFee") },
    { key: "discount", header: t("finance.columns.discount") },
    { key: "final", header: t("finance.columns.final") },
    { key: "dueDate", header: t("finance.columns.dueDate") },
    { key: "status", header: t("finance.columns.status") },
  ])() as ExportColumn[];

  const exportRows = (() =>
    invoices.map((inv) => ({
      invoice: inv.id,
      student: inv.studentName,
      class: inv.class,
      baseFee: formatCurrency(inv.baseFee),
      discount: inv.discountAmt > 0 ? `-${formatCurrency(inv.discountAmt)}` : "—",
      final: formatCurrency(inv.finalAmt),
      dueDate: formatDate(inv.dueDate),
      status: statusConfig[inv.status as keyof typeof statusConfig]?.label ?? inv.status,
    })))();

  const [page, setPage] = useState(1);
  const pageSize = 15;
  const pagedInvoices = (() => invoices.slice((page - 1) * pageSize, page * pageSize))();

  if (invoices.length === 0) {
    return <EmptyState icon={DollarSign} title={t("finance.report.noInvoicesMatch")} compact />;
  }

  return (
    <ReportDataGridContainer
      title={t("finance.report.invoiceReportTitle")}
      columns={exportColumns}
      rows={exportRows}
      moduleId="finance"
      page={page}
      total={invoices.length}
      limit={pageSize}
      onPageChange={setPage}
      paginationVariant="range"
      i18nNamespace="finance"
    >
      <div className="space-y-3 p-3 md:hidden">
        {pagedInvoices.map((invoice) => (
          <article key={invoice.id} className={`${WORK_SURFACE_INNER} space-y-3 p-3`}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div>
                <h4 className="truncate text-sm font-semibold text-foreground">
                  {invoice.studentName}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {invoice.id} • {invoice.class}
                </p>
              </div>
              <StatusBadge status={invoice.status} config={statusConfig} />
            </div>
            <StatGrid>
              <StatRow
                className="min-w-0"
                label={t("finance.columns.baseFee")}
                value={formatCurrency(invoice.baseFee)}
              />
              {invoice.discountAmt > 0 ? (
                <StatRow
                  className="min-w-0"
                  label={t("finance.columns.discount")}
                  value={`-${formatCurrency(invoice.discountAmt)} (${invoice.discountType || "discount"})`}
                  ddClassName="text-destructive font-medium"
                />
              ) : null}
              <StatRow
                className="min-w-0"
                label={t("finance.columns.final")}
                value={formatCurrency(invoice.finalAmt)}
                ddClassName="font-semibold text-foreground"
              />
              <StatRow
                className="min-w-0"
                label={t("finance.columns.dueDate")}
                value={formatDate(invoice.dueDate)}
              />
            </StatGrid>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{t("finance.report.invoiceReportTitle")}</caption>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
              {headers.map((header) => (
                <ModuleTableHeaderCell
                  key={header.key}
                  columnKey={header.key}
                  variant={header.variant}
                  className="px-3 py-2.5"
                >
                  {header.label}
                </ModuleTableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/50">
            {pagedInvoices.map((invoice) => (
              <TableRow key={invoice.id} className="hover:bg-muted/20 transition-colors">
                <TableCell className="px-3 py-2.5 font-medium text-foreground">
                  {invoice.id}
                </TableCell>
                <TableCell className="px-3 py-2.5 font-medium text-foreground">
                  {invoice.studentName}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">{invoice.class}</TableCell>
                <TableCell variant="currency" noWrap className="px-3 py-2.5 text-muted-foreground">
                  {formatCurrency(invoice.baseFee)}
                </TableCell>
                <TableCell variant="currency" noWrap className="px-3 py-2.5 text-destructive">
                  {invoice.discountAmt > 0 ? `-${formatCurrency(invoice.discountAmt)}` : "—"}
                </TableCell>
                <TableCell
                  variant="currency"
                  noWrap
                  className="px-3 py-2.5 font-semibold text-foreground"
                >
                  {formatCurrency(invoice.finalAmt)}
                </TableCell>
                <TableCell noWrap className="px-3 py-2.5 text-muted-foreground">
                  {formatDate(invoice.dueDate)}
                </TableCell>
                <TableCell variant="badge" noWrap className="px-3 py-2.5">
                  <StatusBadge status={invoice.status} config={statusConfig} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportDataGridContainer>
  );
};
