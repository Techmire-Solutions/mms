import type { AppTranslationKey, ElementStyle, TemplateElement } from "@mms/shared";
import { PRINT_COLORS } from "@/lib/ui/printTemplateStyles";
import type {
  VoucherPrintPayload,
  VoucherTemplate,
} from "@/tenant/features/accounting/lib/voucherTemplateModel";

type Field = keyof VoucherPrintPayload & string;
type El = TemplateElement<Field>;

export interface VoucherLayoutCopy {
  voucherNo: string;
  date: string;
  fiscalYear: string;
  purpose: string;
  account: string;
  debit: string;
  credit: string;
  amount: string;
  total: string;
  netPaid: string;
  amountInWords: string;
  preparedBy: string;
  approvedBy: string;
  receiver: string;
  receivedBy: string;
  receiptDeclaration: string;
  receiverName: string;
  receiverIdNo: string;
  signature: string;
  thumbImpression: string;
}

export function voucherLayoutCopy(t: (key: AppTranslationKey) => string): VoucherLayoutCopy {
  return {
    voucherNo: t("accounting.journal.voucher.voucherNo"),
    date: t("accounting.journal.voucher.date"),
    fiscalYear: t("accounting.journal.voucher.fiscalYear"),
    purpose: t("accounting.journal.voucher.purpose"),
    account: t("accounting.journal.voucher.account"),
    debit: t("accounting.journal.voucher.debit"),
    credit: t("accounting.journal.voucher.credit"),
    amount: t("accounting.journal.voucher.amount"),
    total: t("accounting.journal.voucher.total"),
    netPaid: t("accounting.journal.voucher.netPaid"),
    amountInWords: t("accounting.journal.voucher.amountInWords"),
    preparedBy: t("accounting.journal.voucher.preparedBy"),
    approvedBy: t("accounting.journal.voucher.approvedBy"),
    receiver: t("accounting.journal.voucher.paidBy"),
    receivedBy: t("accounting.journal.voucher.receivedBy"),
    receiptDeclaration: t("accounting.journal.voucher.receiptDeclaration"),
    receiverName: t("accounting.journal.voucher.receiverName"),
    receiverIdNo: t("accounting.journal.voucher.receiverIdNo"),
    signature: t("accounting.journal.voucher.signature"),
    thumbImpression: t("accounting.journal.voucher.thumbImpression"),
  };
}

const muted: ElementStyle = { fontSize: 8, color: PRINT_COLORS.lightGray };
const value: ElementStyle = { fontSize: 10, fontWeight: "600" };
const caption: ElementStyle = { fontSize: 8, textAlign: "center", color: PRINT_COLORS.darkGray };

function at(
  id: string,
  type: string,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  field?: Field,
  style?: ElementStyle,
  extra?: Pick<El, "columns" | "tableConfig">,
): El {
  return {
    id,
    type,
    label,
    x,
    y,
    w,
    h,
    ...(field ? { field } : {}),
    ...(style ? { style } : {}),
    ...extra,
  };
}

/** A6 portrait positions. A5 is the same arrangement scaled up to 559×794. */
function a6Elements(copy: VoucherLayoutCopy): El[] {
  const C = PRINT_COLORS;
  return [
    at("logo", "logo", "Logo", 12, 8, 28, 28),
    at("institution", "field", "institution", 46, 6, 220, 16, "institution", {
      fontSize: 12,
      fontWeight: "700",
      color: C.slateDark,
    }),
    at("contact", "field", "contact", 46, 22, 220, 12, "contactLine", muted),
    at("title", "field", "title", 278, 8, 107, 22, "title", {
      fontSize: 8,
      fontWeight: "700",
      color: C.white,
      backgroundColor: C.primaryBlue,
      textAlign: "center",
    }),
    at("ruleHead", "divider", "", 12, 40, 373, 2, undefined, {
      color: C.primaryBlue,
      borderWidth: 2,
    }),
    at("lblVoucher", "static", copy.voucherNo, 12, 46, 120, 10, undefined, muted),
    at("voucherNo", "field", "voucherNo", 12, 56, 120, 14, "voucherNo", value),
    at("lblDate", "static", copy.date, 140, 46, 110, 10, undefined, muted),
    at("date", "field", "date", 140, 56, 110, 14, "date", value),
    at("lblFy", "static", copy.fiscalYear, 258, 46, 127, 10, undefined, muted),
    at("fy", "field", "fiscalYear", 258, 56, 127, 14, "fiscalYear", value),
    at("partyLabel", "field", "partyLabel", 12, 76, 88, 14, "partyLabel", muted),
    at("partyName", "field", "partyName", 102, 76, 283, 14, "partyName", value),
    at("employeeLabel", "field", "employeeIdLabel", 12, 92, 88, 14, "employeeIdLabel", muted),
    at("employeeId", "field", "employeeId", 102, 92, 283, 14, "employeeId", value),
    at("designationLabel", "field", "designationLabel", 12, 108, 88, 14, "designationLabel", muted),
    at("designation", "field", "designation", 102, 108, 283, 14, "designation", value),
    at("periodLabel", "field", "payPeriodLabel", 12, 124, 88, 14, "payPeriodLabel", muted),
    at("payPeriod", "field", "payPeriod", 102, 124, 283, 14, "payPeriod", value),
    at("lblPurpose", "static", copy.purpose, 12, 140, 88, 14, undefined, muted),
    at("purpose", "field", "purpose", 102, 140, 283, 14, "purpose", value),
    at("sourceLabel", "field", "sourceLabel", 12, 156, 88, 14, "sourceLabel", muted),
    at("sourceValue", "field", "sourceValue", 102, 156, 283, 14, "sourceValue", value),
    at(
      "lines",
      "table",
      copy.account,
      12,
      176,
      373,
      108,
      undefined,
      { fontSize: 8, borderWidth: 1, borderColor: C.borderGray },
      {
        columns: [
          { header: copy.account, field: "account" },
          { header: copy.debit, field: "debit", width: 64, align: "right" },
          { header: copy.credit, field: "credit", width: 64, align: "right" },
          { header: copy.amount, field: "amount", width: 64, align: "right" },
        ],
        tableConfig: {
          showHeader: true,
          rowHeight: 16,
          headerBackground: C.borderLighter,
          borderColor: C.borderGray,
        },
      },
    ),
    at("lblWords", "static", copy.amountInWords, 12, 290, 373, 12, undefined, muted),
    at("words", "field", "amountInWords", 12, 302, 373, 20, "amountInWords", {
      fontSize: 8,
      fontStyle: "italic",
    }),
    at("lblTotal", "static", copy.total, 12, 326, 70, 14, undefined, muted),
    at("amount", "field", "amount", 84, 324, 100, 16, "amount", value),
    at("lblNet", "static", copy.netPaid, 196, 326, 70, 14, undefined, muted),
    at("net", "field", "netPaid", 268, 324, 117, 16, "netPaid", value),
    at("preparedName", "field", "preparedBy", 12, 350, 114, 16, "preparedBy", {
      ...caption,
      fontWeight: "600",
    }),
    at("signPrepared", "divider", "", 12, 368, 114, 1, undefined, { color: C.black }),
    at("lblPrepared", "static", copy.preparedBy, 12, 372, 114, 12, undefined, caption),
    at("signApproved", "divider", "", 142, 368, 114, 1, undefined, { color: C.black }),
    at("lblApproved", "static", copy.approvedBy, 142, 372, 114, 12, undefined, caption),
    at("signReceiver", "divider", "", 272, 368, 113, 1, undefined, { color: C.black }),
    at("lblReceiver", "static", copy.receiver, 272, 372, 113, 12, undefined, caption),
    at("recvFrame", "static", "", 12, 392, 373, 150, undefined, {
      borderWidth: 1,
      borderColor: C.primaryBlue,
      borderRadius: 4,
    }),
    at("lblReceived", "static", copy.receivedBy, 20, 398, 240, 12, undefined, {
      fontSize: 8,
      fontWeight: "700",
      color: C.primaryBlue,
    }),
    at("declaration", "static", copy.receiptDeclaration, 20, 412, 250, 20, undefined, {
      fontSize: 7,
      color: C.mediumGray,
    }),
    at("lblRecvName", "static", copy.receiverName, 20, 434, 70, 12, undefined, muted),
    at("recvName", "field", "receiverName", 92, 434, 170, 12, "receiverName", value),
    at("lblRecvId", "static", copy.receiverIdNo, 20, 450, 70, 12, undefined, muted),
    at("recvId", "field", "receiverId", 92, 450, 170, 12, "receiverId", value),
    at("lblRecvSign", "static", copy.signature, 20, 466, 70, 12, undefined, muted),
    at("recvSign", "field", "receiverSign", 92, 466, 170, 12, "receiverSign", value),
    at("lblRecvDate", "static", copy.date, 20, 482, 70, 12, undefined, muted),
    at("recvDate", "field", "receiverDate", 92, 482, 170, 12, "receiverDate", value),
    at("thumb", "static", copy.thumbImpression, 286, 412, 88, 72, undefined, {
      fontSize: 7,
      textAlign: "center",
      color: C.lightGray,
      borderWidth: 1,
      borderColor: C.ruleGray,
      borderRadius: 4,
    }),
  ];
}

function scaleElements(elements: El[], sx: number, sy: number): El[] {
  return elements.map((el) => ({
    ...el,
    x: Math.round(el.x * sx),
    y: Math.round(el.y * sy),
    w: Math.round(el.w * sx),
    h: Math.max(1, Math.round(el.h * sy)),
    columns: el.columns?.map((col) => ({
      ...col,
      width: col.width ? Math.round(col.width * sx) : undefined,
    })),
    tableConfig: el.tableConfig?.rowHeight
      ? { ...el.tableConfig, rowHeight: Math.round(el.tableConfig.rowHeight * sy) }
      : el.tableConfig,
  }));
}

export function buildVoucherTemplate(
  pageSize: "A5" | "A6",
  copy: VoucherLayoutCopy,
): VoucherTemplate {
  const a6 = a6Elements(copy);
  if (pageSize === "A6") return { pageSize: "A6", orientation: "portrait", elements: a6 };
  return {
    pageSize: "A5",
    orientation: "portrait",
    elements: scaleElements(a6, 559 / 397, 794 / 559),
  };
}
