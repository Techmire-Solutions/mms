import {
  type Invoice,
  type Payment,
  type FinanceSettings,
  DEFAULT_FINANCE_SETTINGS,
  INVOICE_STATUSES,
  type InvoiceStatus,
  OPEN_INVOICE_STATUSES,
  type OpenInvoiceStatus,
  isOpenInvoiceStatus,
} from "@mms/shared";

export type { Invoice, Payment, FinanceSettings, InvoiceStatus, OpenInvoiceStatus };
export { DEFAULT_FINANCE_SETTINGS, INVOICE_STATUSES, OPEN_INVOICE_STATUSES, isOpenInvoiceStatus };

export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Online", "Cheque", "Other"] as const;
