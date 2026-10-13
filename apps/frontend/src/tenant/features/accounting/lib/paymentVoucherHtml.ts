import { escapeHtml } from "@/lib/escapeHtml";
import { PRINT_COLORS } from "@/lib/printTemplateStyles";
import type { VoucherPrintLayout } from "@/tenant/features/accounting/components/paymentVoucherKind";

/** A5 portrait at 96 dpi — two vouchers per A4 sheet when printed 2-up. */
export const PAYMENT_VOUCHER_PAGE = { width: 559, height: 794 } as const;

export const PAYMENT_VOUCHER_LABEL_KEYS = [
  "title",
  "voucherNo",
  "date",
  "fiscalYear",
  "paidTo",
  "employeeId",
  "designation",
  "payPeriod",
  "purpose",
  "paidFrom",
  "particulars",
  "account",
  "debit",
  "credit",
  "deduction",
  "amount",
  "total",
  "netPaid",
  "amountInWords",
  "preparedBy",
  "approvedBy",
  "paidBy",
  "receivedBy",
  "receiverName",
  "receiverIdNo",
  "signature",
  "thumbImpression",
  "receiptDeclaration",
] as const;

export type PaymentVoucherLabels = Record<(typeof PAYMENT_VOUCHER_LABEL_KEYS)[number], string>;

export interface PaymentVoucherPrintInput {
  labels: PaymentVoucherLabels;
  institution: { name: string; logoUrl: string; contactLine: string };
  primaryColor: string;
  voucherNo: string;
  date: string;
  fiscalYear: string;
  narration: string;
  /** `null` prints blank handwriting lines (expenses, or a salary payee that could not be resolved). */
  payee: { name: string; employeeId: string; designation: string } | null;
  payPeriod: string | null;
  paidFrom: string[];
  particulars: { account: string; amount: string }[];
  /** Non-cash credits (salary deductions and similar). Empty when the whole amount was paid in cash. */
  deductions: { account: string; amount: string }[];
  /** Formatted net cash paid. Empty when there are no deductions. */
  netPaid: string;
  amount: string;
  amountInWords: string;
  layout: VoucherPrintLayout;
  /** Logged-in user who entered the voucher, printed on the Prepared By line. */
  preparedByName: string;
  journalLines: { account: string; debit: string; credit: string }[];
}

const C = PRINT_COLORS;

function voucherStyles(primary: string): string {
  return `<style>
  .pv { width: ${PAYMENT_VOUCHER_PAGE.width}px; min-height: ${PAYMENT_VOUCHER_PAGE.height}px; padding: 28px; color: ${C.black}; font-size: 11px; line-height: 1.45; }
  .pv-head { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid ${primary}; padding-bottom: 10px; }
  .pv-logo { width: 44px; height: 44px; object-fit: contain; }
  .pv-org { flex: 1; } .pv-org h1 { font-size: 16px; font-weight: 700; } .pv-org p { color: ${C.lightGray}; font-size: 10px; }
  .pv-title { background: ${primary}; color: ${C.white}; font-weight: 700; font-size: 12px; padding: 5px 12px; border-radius: 4px; letter-spacing: .04em; text-transform: uppercase; }
  .pv-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 12px 0; }
  .pv-cell { border: 1px solid ${C.borderLight}; border-radius: 4px; padding: 5px 8px; }
  .pv-k { display: block; color: ${C.lightGray}; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  .pv-v { font-weight: 600; min-height: 15px; }
  .pv-row { display: flex; gap: 8px; align-items: baseline; margin: 7px 0; }
  .pv-row .pv-k { flex: 0 0 120px; font-size: 10px; }
  .pv-row .pv-v { flex: 1; border-bottom: 1px dotted ${C.ruleGray}; padding-bottom: 2px; }
  table.pv-t { width: 100%; border-collapse: collapse; margin: 10px 0; }
  .pv-t th, .pv-t td { border: 1px solid ${C.borderGray}; padding: 5px 8px; text-align: start; }
  .pv-t th { background: ${C.borderLighter}; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  .pv-t .num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .pv-t tfoot td { font-weight: 700; }
  .pv-words { border: 1px dashed ${C.borderGray}; border-radius: 4px; padding: 6px 8px; font-style: italic; }
  .pv-signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 26px; }
  .pv-sign { text-align: center; } .pv-sign-line { height: 34px; border-bottom: 1px solid ${C.black}; margin-bottom: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: 600; }
  .pv-recv { margin-top: 18px; border: 1.5px solid ${primary}; border-radius: 6px; padding: 10px 12px; display: flex; gap: 12px; }
  .pv-recv-body { flex: 1; } .pv-recv h2 { font-size: 11px; font-weight: 700; color: ${primary}; text-transform: uppercase; letter-spacing: .04em; }
  .pv-recv .pv-decl { color: ${C.mediumGray}; font-size: 10px; margin: 2px 0 6px; }
  .pv-thumb { width: 86px; border: 1px dashed ${C.ruleGray}; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; padding: 4px; color: ${C.lightGray}; font-size: 9px; text-align: center; }
</style>`;
}

function cell(label: string, value: string): string {
  return `<div class="pv-cell"><span class="pv-k">${escapeHtml(label)}</span><span class="pv-v">${escapeHtml(value)}</span></div>`;
}

/** Labelled value on a dotted line; an empty value leaves the line blank for handwriting. */
function line(label: string, value = ""): string {
  return `<div class="pv-row"><span class="pv-k">${escapeHtml(label)}</span><span class="pv-v">${escapeHtml(value)}</span></div>`;
}

function sign(label: string, name = ""): string {
  return `<div class="pv-sign"><div class="pv-sign-line">${escapeHtml(name)}</div>${escapeHtml(label)}</div>`;
}

function paymentTable(input: PaymentVoucherPrintInput): string {
  const rows = input.particulars
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.account)}</td><td class="num">${escapeHtml(row.amount)}</td></tr>`,
    )
    .join("");
  const deductions = input.deductions
    .map(
      (row) =>
        `<tr><td>${escapeHtml(input.labels.deduction)}: ${escapeHtml(row.account)}</td><td class="num">${escapeHtml(row.amount)}</td></tr>`,
    )
    .join("");
  const net = input.netPaid
    ? `<tr><td>${escapeHtml(input.labels.netPaid)}</td><td class="num">${escapeHtml(input.netPaid)}</td></tr>`
    : "";
  return `<table class="pv-t">
    <thead><tr><th>${escapeHtml(input.labels.particulars)}</th><th class="num">${escapeHtml(input.labels.amount)}</th></tr></thead>
    <tbody>${rows}${deductions}</tbody>
    <tfoot><tr><td>${escapeHtml(input.labels.total)}</td><td class="num">${escapeHtml(input.amount)}</td></tr>${net}</tfoot>
  </table>`;
}

function journalTable(input: PaymentVoucherPrintInput): string {
  const rows = input.journalLines
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.account)}</td><td class="num">${escapeHtml(row.debit)}</td><td class="num">${escapeHtml(row.credit)}</td></tr>`,
    )
    .join("");
  return `<table class="pv-t">
    <thead><tr><th>${escapeHtml(input.labels.account)}</th><th class="num">${escapeHtml(input.labels.debit)}</th><th class="num">${escapeHtml(input.labels.credit)}</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>${escapeHtml(input.labels.total)}</td><td class="num">${escapeHtml(input.amount)}</td><td class="num">${escapeHtml(input.amount)}</td></tr></tfoot>
  </table>`;
}

/** Body markup for {@link buildPrintWindowHtml}; every interpolated value is HTML-escaped. */
export function buildPaymentVoucherBody(input: PaymentVoucherPrintInput): string {
  const { labels: L, institution, payee } = input;
  const logo = institution.logoUrl
    ? `<img class="pv-logo" src="${escapeHtml(institution.logoUrl)}" alt="" />`
    : "";
  const party =
    input.layout === "journal"
      ? ""
      : `
  ${line(L.paidTo, payee?.name ?? "")}
  ${payee ? line(L.employeeId, payee.employeeId) + line(L.designation, payee.designation) : ""}
  ${input.payPeriod ? line(L.payPeriod, input.payPeriod) : ""}
  ${line(L.purpose, input.narration)}
  ${line(L.paidFrom, input.paidFrom.join(", "))}`;
  const narration = input.layout === "journal" ? line(L.purpose, input.narration) : "";
  const signs = `${sign(L.preparedBy, input.preparedByName)}${sign(L.approvedBy)}${sign(L.paidBy)}`;
  const receiver =
    input.layout === "payment"
      ? `
  <section class="pv-recv">
    <div class="pv-recv-body">
      <h2>${escapeHtml(L.receivedBy)}</h2>
      <p class="pv-decl">${escapeHtml(L.receiptDeclaration)}</p>
      ${line(L.receiverName)}${line(L.receiverIdNo)}${line(L.signature)}${line(L.date)}
    </div>
    <div class="pv-thumb">${escapeHtml(L.thumbImpression)}</div>
  </section>`
      : "";

  return `${voucherStyles(input.primaryColor)}
<div class="pv">
  <header class="pv-head">${logo}
    <div class="pv-org"><h1>${escapeHtml(institution.name)}</h1><p>${escapeHtml(institution.contactLine)}</p></div>
    <div class="pv-title">${escapeHtml(L.title)}</div>
  </header>
  <section class="pv-meta">
    ${cell(L.voucherNo, input.voucherNo)}${cell(L.date, input.date)}${cell(L.fiscalYear, input.fiscalYear)}
  </section>
  ${party}
  ${narration}
  ${input.layout === "journal" ? journalTable(input) : paymentTable(input)}
  <div class="pv-words"><span class="pv-k">${escapeHtml(L.amountInWords)}</span>${escapeHtml(input.amountInWords)}</div>
  <section class="pv-signs">${signs}</section>
  ${receiver}
</div>`;
}
