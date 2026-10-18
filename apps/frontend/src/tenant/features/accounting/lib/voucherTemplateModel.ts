import type { BrandingSettings, DocumentTemplate } from "@mms/shared";
import { createDocumentTemplateStore } from "@/lib/documentTemplatePersistence";
import type { PaymentVoucherModel } from "@/tenant/features/accounting/lib/paymentVoucherModel";

/** Settings singleton for the accounting voucher layout. Includes "template" so title-case is skipped. */
export const ACCOUNTING_VOUCHER_TEMPLATE_KEY = "accounting_voucher_template";
export const ACCOUNTING_VOUCHER_TEMPLATE_CHANGED_EVENT = "mms:accounting-voucher-template-changed";

export interface VoucherLine {
  account: string;
  debit: string;
  credit: string;
  amount: string;
}

/** Flat print payload. `lines` is the only array so the template table binds to it. */
export interface VoucherPrintPayload {
  title: string;
  institution: string;
  contactLine: string;
  voucherNo: string;
  date: string;
  fiscalYear: string;
  partyLabel: string;
  partyName: string;
  employeeIdLabel: string;
  employeeId: string;
  designationLabel: string;
  designation: string;
  payPeriodLabel: string;
  payPeriod: string;
  purpose: string;
  sourceLabel: string;
  sourceValue: string;
  lines: VoucherLine[];
  amount: string;
  netPaid: string;
  amountInWords: string;
  preparedBy: string;
  /** Blank on purpose: the receiver writes these by hand. */
  receiverName: string;
  receiverId: string;
  receiverSign: string;
  receiverDate: string;
}

export type VoucherTemplate = DocumentTemplate<VoucherPrintPayload>;

export const voucherTemplateDocumentStore = createDocumentTemplateStore<VoucherPrintPayload>({
  key: ACCOUNTING_VOUCHER_TEMPLATE_KEY,
  changedEvent: ACCOUNTING_VOUCHER_TEMPLATE_CHANGED_EVENT,
  documentName: "voucher",
});

export function loadVoucherTemplate(fallback: VoucherTemplate): VoucherTemplate {
  return voucherTemplateDocumentStore.load(fallback);
}

/** Institution contact strip printed under the voucher heading. */
export function voucherContactLine(
  branding: Pick<BrandingSettings, "addressLine1" | "city" | "phone">,
): string {
  return [branding.addressLine1, branding.city, branding.phone].filter(Boolean).join(" · ");
}

export function voucherTableLines(
  model: PaymentVoucherModel,
  formatMoney: (amount: number) => string,
  deductionLabel: string,
): VoucherLine[] {
  if (model.layout === "journal") {
    return model.journalLines.map((row) => ({
      account: row.account,
      debit: row.debit > 0 ? formatMoney(row.debit) : "",
      credit: row.credit > 0 ? formatMoney(row.credit) : "",
      amount: "",
    }));
  }
  const particulars = model.particulars.map((row) => ({
    account: row.account,
    debit: formatMoney(row.amount),
    credit: "",
    amount: formatMoney(row.amount),
  }));
  const deductions = model.deductions.map((row) => ({
    account: `${deductionLabel}: ${row.account}`,
    debit: "",
    credit: formatMoney(row.amount),
    amount: formatMoney(row.amount),
  }));
  return [...particulars, ...deductions];
}
