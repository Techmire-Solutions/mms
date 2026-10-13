import type { TabDefinition } from "../contacts/contactTypes.js";
import type { ModuleFieldDef } from "../settings/moduleFieldSchema.js";
import { INITIAL_FINANCE_FIELD_SEED } from "../settings/moduleFieldSetupFinance.js";
import type { SequenceYearFormat, SequenceRolloverPolicy } from "../core/sequenceNumberingTypes.js";

// ─── Finance Module Settings ──────────────────────────────────────────────────

export interface FinanceSettings {
  currency: string;
  invoicePrefix: string;
  dueDays: string;
  lateFeePercent: string;
  taxRate: string;
  paymentMethods: string[];
  autoGenerateInvoice: boolean;
  invoiceYearFormat?: SequenceYearFormat;
  invoiceSequenceDigits?: number;
  invoiceDelimiter?: string;
  invoiceStartingSequence?: number;
  invoiceRolloverPolicy?: SequenceRolloverPolicy;
  invoiceCurrentSequence?: number;
  sendInvoiceEmail: boolean;
  allowPartialPayment: boolean;
  requireApproval: boolean;
  overdueReminder: boolean;
  reminderDaysBefore: string;
  feeReminders: boolean;
  defaultViewLayout?: string;
  fields?: Record<string, unknown>;
  customFields?: [];
  fieldOrder?: string[];
  formTabs?: TabDefinition[];
  enabledTabs?: string[];
  requiredTabs?: string[];
}

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  currency: "PKR",
  invoicePrefix: "INV",
  dueDays: "30",
  lateFeePercent: "5",
  taxRate: "0",
  paymentMethods: ["cash", "bank_transfer"],
  autoGenerateInvoice: true,
  sendInvoiceEmail: true,
  allowPartialPayment: true,
  requireApproval: false,
  overdueReminder: true,
  reminderDaysBefore: "3",
  feeReminders: true,
  defaultViewLayout: "list",
  fields: {
    basic: INITIAL_FINANCE_FIELD_SEED.basic.map((f) => ({ ...f })),
  },
  fieldOrder: ["studentId", "amount", "dueDate", "status"],
};

export const DEFAULT_FINANCE_FIELD_DEFS: ModuleFieldDef[] = [
  { id: "amount", label: "Amount", required: true },
  { id: "method", label: "Payment Method" },
  { id: "date", label: "Payment Date" },
  { id: "receivedBy", label: "Received By" },
  { id: "note", label: "Note" },
];
