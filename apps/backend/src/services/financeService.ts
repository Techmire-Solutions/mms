import { financeUseCases } from "../finance/use-cases/financeUseCases.js";

/**
 * Thin re-export of the finance use-cases facade.
 *
 * Kept for backward compatibility with existing importers (report routes,
 * dashboard summary, tests). New code should depend on
 * `finance/use-cases/financeUseCases.js` directly.
 */
export const loadInvoices = financeUseCases.loadInvoices;
export const createInvoice = financeUseCases.createInvoice;
export const updateInvoiceById = financeUseCases.updateInvoiceById;
export const deleteInvoiceById = financeUseCases.deleteInvoiceById;
export const restoreInvoiceById = financeUseCases.restoreInvoiceById;
export const bulkSoftDeleteInvoices = financeUseCases.bulkSoftDeleteInvoices;
export const bulkRestoreInvoices = financeUseCases.bulkRestoreInvoices;
export const getInvoiceById = financeUseCases.getInvoiceById;
export const getInvoicesByIds = financeUseCases.getInvoicesByIds;
export const bulkUpdateInvoicesStatus = financeUseCases.bulkUpdateInvoicesStatus;
export const loadInvoicesPage = financeUseCases.loadInvoicesPage;
export const loadPayments = financeUseCases.loadPayments;
export const updatePaymentById = financeUseCases.updatePaymentById;
export const deletePaymentById = financeUseCases.deletePaymentById;
export const restorePaymentById = financeUseCases.restorePaymentById;
export const bulkSoftDeletePayments = financeUseCases.bulkSoftDeletePayments;
export const bulkRestorePayments = financeUseCases.bulkRestorePayments;
export const getPaymentById = financeUseCases.getPaymentById;
export const getPaymentsByIds = financeUseCases.getPaymentsByIds;
export const loadPaymentsPage = financeUseCases.loadPaymentsPage;
export const createPayment = financeUseCases.createPayment;
export const loadFinanceReportAggregates = financeUseCases.loadFinanceReportAggregates;
export const loadFinanceCommandMetrics = financeUseCases.loadFinanceCommandMetrics;
export const loadFinanceWidgetAggregates = financeUseCases.loadFinanceWidgetAggregates;
