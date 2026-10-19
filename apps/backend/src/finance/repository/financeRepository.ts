import type {
  Invoice,
  Payment,
  FinanceListQuery,
  FinanceInvoicesListPageResult,
  FinancePaymentsListPageResult,
  FinanceCommandMetricsSnapshot,
  FinanceReportAggregates,
  FinanceReportComparisonQuery,
  WidgetQuery,
  WidgetAggregateResult,
} from "@mms/shared";

/**
 * Sole storage gateway for the finance module (invoices + payments).
 *
 * Mirrors the `contacts`/`sessions`/`enrollments` reference pattern: routes and
 * use-cases depend on this interface (never on Drizzle directly), and the
 * Drizzle-backed adapter is the only implementation. Tests can inject a fake
 * repository at the seam.
 */
export interface FinanceRepository {
  // Invoices
  listInvoicesByWorkspace(
    tenant: string,
    options?: {
      deleted?: "active" | "deleted" | "all";
      includeDeleted?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<Invoice[]>;
  findInvoiceById(tenant: string, id: string): Promise<Invoice | null>;
  findInvoicesByIds(
    tenant: string,
    ids: string[],
    options?: { includeDeleted?: boolean },
  ): Promise<Invoice[]>;
  saveInvoice(tenant: string, record: Invoice): Promise<void>;
  /** Live invoice ids raised for one enrollment (any billing period). */
  findInvoiceIdsByEnrollment(tenant: string, enrollmentId: string): Promise<string[]>;
  listInvoicesPage(tenant: string, query: FinanceListQuery): Promise<FinanceInvoicesListPageResult>;
  bulkUpdateInvoicesStatus(
    tenant: string,
    ids: string[],
    status: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkSoftDeleteInvoices(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreInvoices(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;

  // Payments
  listPaymentsByWorkspace(
    tenant: string,
    options?: {
      deleted?: "active" | "deleted" | "all";
      includeDeleted?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<Payment[]>;
  findPaymentById(tenant: string, id: string): Promise<Payment | null>;
  findPaymentsByIds(
    tenant: string,
    ids: string[],
    options?: { includeDeleted?: boolean },
  ): Promise<Payment[]>;
  savePayment(tenant: string, record: Payment): Promise<void>;
  listPaymentsPage(tenant: string, query: FinanceListQuery): Promise<FinancePaymentsListPageResult>;
  bulkSoftDeletePayments(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestorePayments(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;

  // Aggregates
  aggregateFinanceCommandMetrics(tenant: string): Promise<FinanceCommandMetricsSnapshot>;
  aggregateFinanceWidgetQueries(
    tenant: string,
    queries: WidgetQuery[],
  ): Promise<Record<string, WidgetAggregateResult>>;
  loadFinanceReportAggregates(
    tenant: string,
    comparisonQuery?: FinanceReportComparisonQuery,
  ): Promise<FinanceReportAggregates>;
}
