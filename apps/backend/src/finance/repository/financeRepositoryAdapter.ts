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
} from "../../db/repositories/financeRepository.js";
import {
  listInvoicesPage,
  listPaymentsPage,
  aggregateFinanceCommandMetrics,
  bulkUpdateInvoicesStatusSql,
} from "../../db/repositories/financeRepositoryList.js";
import { loadFinanceReportAggregatesSql } from "../../db/repositories/financeRepositoryReport.js";
import { aggregateFinanceWidgetQueries } from "../../db/repositories/financeRepositoryWidgets.js";
import { findInvoiceIdsByEnrollment } from "../../db/repositories/financeInvoiceGenerationRepository.js";
import { findEntryIdBySource } from "../../db/repositories/accountingRepository.js";

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
