/**
 * @file financeTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Finance & Invoicing.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface FinanceTransferEntity {
  invoiceNumber: string;
  recipient: string;
  issueDate?: string;
  dueDate?: string;
  amount: string | number;
  currency?: string;
  status?: string;
  paymentMethod?: string;
  notes?: string;
}

export const financeTransferSchema: ModuleTransferSchema<FinanceTransferEntity> =
  createModuleTransferSchema<FinanceTransferEntity>({
    moduleId: "finance",
    entityNounPlural: "invoices",
    defaultFilename: "invoices.csv",
    fields: [
      {
        key: "invoiceNumber",
        label: "Invoice Number",
        aliases: ["invoice_no", "Invoice #", "Reference"],
        required: true,
        sample: "INV-2024-001",
        extract: (f) => f.invoiceNumber || "",
      },
      {
        key: "recipient",
        label: "Recipient / Student",
        aliases: ["student", "Payer", "Bill To"],
        required: true,
        sample: "Ali ibn Husayn",
        extract: (f) => f.recipient || "",
      },
      {
        key: "issueDate",
        label: "Issue Date",
        aliases: ["issue_date", "Invoice Date", "Date"],
        sample: "2024-09-01",
        extract: (f) => f.issueDate || "",
      },
      {
        key: "dueDate",
        label: "Due Date",
        aliases: ["due_date", "Payment Due"],
        sample: "2024-09-15",
        extract: (f) => f.dueDate || "",
      },
      {
        key: "amount",
        label: "Total Amount",
        aliases: ["amount", "Total", "Due Amount"],
        required: true,
        sample: "15000.00",
        extract: (f) => (f.amount != null ? String(f.amount) : "0.00"),
      },
      {
        key: "currency",
        label: "Currency",
        aliases: ["curr"],
        sample: "PKR",
        extract: (f) => f.currency || "PKR",
      },
      {
        key: "status",
        label: "Payment Status",
        aliases: ["invoice_status", "Status"],
        sample: "unpaid",
        extract: (f) => f.status || "unpaid",
      },
      {
        key: "paymentMethod",
        label: "Payment Method",
        aliases: ["payment_mode", "Channel"],
        sample: "Bank Transfer",
        extract: (f) => f.paymentMethod || "",
      },
      {
        key: "notes",
        label: "Payment Notes / Terms",
        aliases: ["terms", "Remarks"],
        sample: "Net 15 days term",
        extract: (f) => f.notes || "",
      },
    ],
  });

registerModuleTransferSchema(financeTransferSchema);
