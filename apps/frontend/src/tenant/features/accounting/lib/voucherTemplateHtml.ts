import { getPageDimensions, type TemplateElement } from "@mms/shared";
import { escapeHtml } from "@/lib/escapeHtml";
import { PRINT_COLORS } from "@/lib/ui/printTemplateStyles";
import {
  resolveElementGeometry,
  resolveElementText,
  resolveTableRows,
  visibleTableRowCount,
} from "@/components/template-editor/templateDataResolution";
import type {
  VoucherPrintPayload,
  VoucherTemplate,
} from "@/tenant/features/accounting/lib/voucherTemplateModel";

function payloadRecord(data: VoucherPrintPayload): Record<string, unknown> {
  return {
    title: data.title,
    institution: data.institution,
    contactLine: data.contactLine,
    voucherNo: data.voucherNo,
    date: data.date,
    fiscalYear: data.fiscalYear,
    partyLabel: data.partyLabel,
    partyName: data.partyName,
    employeeIdLabel: data.employeeIdLabel,
    employeeId: data.employeeId,
    designationLabel: data.designationLabel,
    designation: data.designation,
    payPeriodLabel: data.payPeriodLabel,
    payPeriod: data.payPeriod,
    purpose: data.purpose,
    sourceLabel: data.sourceLabel,
    sourceValue: data.sourceValue,
    lines: data.lines,
    amount: data.amount,
    netPaid: data.netPaid,
    amountInWords: data.amountInWords,
    preparedBy: data.preparedBy,
    receiverName: data.receiverName,
    receiverId: data.receiverId,
    receiverSign: data.receiverSign,
    receiverDate: data.receiverDate,
  };
}

function cssColor(value: string | undefined, fallback: string): string {
  return value && /^[#(),.%\w\s-]+$/.test(value) ? value : fallback;
}

function styleAttr(parts: string[]): string {
  return parts.filter(Boolean).join(";");
}

function boxStyle(el: TemplateElement, textAlign: string): string {
  const s = el.style ?? {};
  return styleAttr([
    "position:absolute",
    "box-sizing:border-box",
    `left:${el.x}px`,
    `top:${el.y}px`,
    `width:${el.w}px`,
    `height:${el.h}px`,
    `font-size:${s.fontSize ?? 10}px`,
    `font-weight:${/^[\w\s]+$/.test(String(s.fontWeight ?? "normal")) ? (s.fontWeight ?? "normal") : "normal"}`,
    `font-style:${s.fontStyle === "italic" ? "italic" : "normal"}`,
    `text-align:${textAlign}`,
    `color:${cssColor(s.color, PRINT_COLORS.black)}`,
    s.backgroundColor ? `background:${cssColor(s.backgroundColor, PRINT_COLORS.white)}` : "",
    s.borderWidth
      ? `border:${s.borderWidth}px solid ${cssColor(s.borderColor, PRINT_COLORS.borderGray)}`
      : "",
    s.borderRadius != null ? `border-radius:${s.borderRadius}px` : "",
    "overflow:hidden",
  ]);
}

function tableHtml(el: TemplateElement, data: VoucherPrintPayload): string {
  const rows = (resolveTableRows(el, payloadRecord(data)) ?? []).slice(0, visibleTableRowCount(el));
  const columns = el.columns ?? [];
  const border = cssColor(el.tableConfig?.borderColor, PRINT_COLORS.borderGray);
  const headerBg = cssColor(el.tableConfig?.headerBackground, PRINT_COLORS.borderLighter);
  const header =
    el.tableConfig?.showHeader === false
      ? ""
      : `<tr>${columns
          .map((col) => {
            const align = col.align === "right" || col.align === "center" ? col.align : "left";
            return `<th style="text-align:${align};width:${col.width ? `${col.width}px` : "auto"};background:${headerBg};border:1px solid ${border};padding:2px 4px">${escapeHtml(col.header)}</th>`;
          })
          .join("")}</tr>`;
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((col) => {
            const align = col.align === "right" || col.align === "center" ? col.align : "left";
            return `<td style="text-align:${align};border:1px solid ${border};padding:2px 4px">${escapeHtml(String(row[col.field] ?? ""))}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return `<table style="width:100%;height:100%;border-collapse:collapse;font-size:inherit"><thead>${header}</thead><tbody>${body}</tbody></table>`;
}

function elementHtml(
  el: TemplateElement,
  data: VoucherPrintPayload,
  logoUrl: string,
  direction: "ltr" | "rtl",
): string {
  const text = resolveElementText(el, payloadRecord(data), "print", (label) => label);
  const geometry = resolveElementGeometry(el, direction, text);
  const style = boxStyle(el, geometry.textAlign);
  if (el.type === "logo") {
    const image = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="" style="width:100%;height:100%;object-fit:contain" />`
      : "";
    return `<div style="${style}">${image}</div>`;
  }
  if (el.type === "divider") {
    return `<div style="${style};border-top:${el.style?.borderWidth ?? 1}px solid ${cssColor(el.style?.color, PRINT_COLORS.black)};height:0"></div>`;
  }
  if (el.type === "table") return `<div style="${style}">${tableHtml(el, data)}</div>`;
  return `<div dir="${geometry.direction}" style="${style}">${escapeHtml(text)}</div>`;
}

/** Print-window body for a saved voucher template. Text is escaped; positions come from the template. */
export function buildVoucherTemplateHtml(options: {
  template: VoucherTemplate;
  data: VoucherPrintPayload;
  logoUrl: string;
  direction: "ltr" | "rtl";
}): string {
  const size = getPageDimensions(
    options.template.pageSize,
    options.template.orientation ?? "portrait",
  );
  const body = options.template.elements
    .map((el) => elementHtml(el, options.data, options.logoUrl, options.direction))
    .join("");
  return `<div style="position:relative;width:${size.width}px;height:${size.height}px;background:${PRINT_COLORS.white};overflow:hidden">${body}</div>`;
}
