import type { FinanceRepository } from "./financeRepository.js";
import {
  listInvoicesByWorkspace,
  findInvoiceById,
  findInvoicesByIds,
  saveInvoice,
  bulkSoftDeleteInvoices,
  bulkRestoreInvoices,
  listPaymentsByWorkspace,
  findPaymentById,
  findPaymentsByIds,
  savePayment,
  bulkSoftDeletePayments,
  bulkRestorePayments,
} from "../repository/db/financeRepository.js";
import {
  listInvoicesPage,
  listPaymentsPage,
  aggregateFinanceCommandMetrics,
  bulkUpdateInvoicesStatusSql,
} from "../repository/db/financeRepositoryList.js";
import { loadFinanceReportAggregatesSql } from "../repository/db/financeRepositoryReport.js";
import { aggregateFinanceWidgetQueries } from "../repository/db/financeRepositoryWidgets.js";
import { findInvoiceIdsByEnrollment } from "../repository/db/financeInvoiceGenerationRepository.js";
import { findEntryIdBySource } from "../deps.js";

/** Ledger posting lookup for finance sources (invoice / payment). */
export async function findLedgerPostingIdBySource(
  tenant: string,
  sourceType: "invoice" | "payment",
  sourceId: string,
): Promise<string | null> {
  return findEntryIdBySource(tenant, sourceType, sourceId);
}

/**
 * Drizzle-backed adapter for {@link FinanceRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const financeRepository: FinanceRepository = {
  listInvoicesByWorkspace,
  findInvoiceById,
  findInvoicesByIds,
  saveInvoice,
  findInvoiceIdsByEnrollment,
  listInvoicesPage,
  bulkUpdateInvoicesStatus: bulkUpdateInvoicesStatusSql,
  bulkSoftDeleteInvoices,
  bulkRestoreInvoices,
  listPaymentsByWorkspace,
  findPaymentById,
  findPaymentsByIds,
  savePayment,
  listPaymentsPage,
  bulkSoftDeletePayments,
  bulkRestorePayments,
  findLedgerPostingIdBySource,
  aggregateFinanceCommandMetrics,
  aggregateFinanceWidgetQueries,
  loadFinanceReportAggregates: loadFinanceReportAggregatesSql,
};
