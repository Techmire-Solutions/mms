import {
  FINANCE_PAYMENT_METHODS,
  type FinancePaymentMethod,
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

/** Canonical shared payment-method vocabulary (see accountingEnums). */
export const PAYMENT_METHODS = FINANCE_PAYMENT_METHODS;
export type PaymentMethod = FinancePaymentMethod;
