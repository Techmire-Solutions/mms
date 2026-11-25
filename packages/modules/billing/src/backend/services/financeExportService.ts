/**
 * @file financeExportService.ts
 * @description Finance (invoices) CSV export, wired to the shared data-transfer schema SSOT.
 */
import {
  buildTenantExportFilename,
  type ExportColumn,
  type FinanceListQuery,
  type Invoice,
} from "@mms/contracts";
import { financeTransferSchema, type FinanceTransferEntity } from "@mms/contracts";
import { throwIfBackgroundJobAborted } from "@mms/be-core/jobs/backgroundJobAbort";
import { financeRepository } from "../repository/financeRepositoryAdapter.js";

/**
 * Maps a persisted invoice to the transfer entity. `currency`, `notes` and a true `issueDate` are
 * not persisted per-invoice (currency is workspace-level and the invoice has no notes column), so
 * they are left empty; `issueDate` falls back to the billing period.
 */
function invoiceToTransferEntity(invoice: Invoice): FinanceTransferEntity {
  return {
    invoiceNumber: invoice.invoiceNumber ?? invoice.id,
    recipient: invoice.studentName ?? "",
    issueDate: invoice.billingPeriod ?? "",
    dueDate: invoice.dueDate ?? "",
    amount: invoice.finalAmt ?? 0,
    currency: "",
    status: invoice.status ?? "",
    paymentMethod: invoice.method ?? "",
    notes: "",
  };
}

export async function buildFinanceCsvExport(
  query: Record<string, unknown>,
  options: { columns?: unknown; filename?: string; viewerRole: string; allowDeleted?: boolean },
  tenant?: string,
  signal?: AbortSignal,
): Promise<{ csv: string; filename: string; count: number }> {
  const columns =
    Array.isArray(options.columns) && options.columns.length > 0
      ? (options.columns as ExportColumn[])
      : financeTransferSchema.exportColumns;

  const all: Invoice[] = [];
  let page = 1;
  for (;;) {
    throwIfBackgroundJobAborted(signal);
    const result = await financeRepository.listInvoicesPage(tenant ?? "", {
      page,
      limit: 500,
      search: typeof query.search === "string" ? query.search : "",
      sortField: typeof query.sortField === "string" ? query.sortField : "dueDate",
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
      includeDeleted: options.allowDeleted === true,
    } as FinanceListQuery);
    all.push(...result.invoices);
    if (!result.hasMore) break;
    page += 1;
  }

  const csv = financeTransferSchema.toExportCsv(all.map(invoiceToTransferEntity), columns);
  const rawFilename = options.filename?.trim() || "invoices.csv";
  const filename = buildTenantExportFilename(tenant ?? "", rawFilename);
  return {
    csv,
    filename: filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`,
    count: all.length,
  };
}
