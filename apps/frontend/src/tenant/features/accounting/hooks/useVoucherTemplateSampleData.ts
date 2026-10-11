import { useMemo } from "react";
import {
  formatAmountInWords,
  formatDate,
  type AppTranslationKey,
  type BrandingSettings,
  type TemplateFieldDefinition,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useAuth } from "@/lib/contexts/AuthContext";
import { VOUCHER_KIND_TITLE_KEY } from "@/tenant/features/accounting/components/paymentVoucherKind";
import {
  voucherContactLine,
  type VoucherPrintPayload,
} from "@/tenant/features/accounting/components/voucherTemplateModel";

type ScalarField = Exclude<keyof VoucherPrintPayload, "lines">;

const FIELD_LABEL_KEYS: readonly (readonly [ScalarField, AppTranslationKey])[] = [
  ["title", "accounting.journal.voucher.title"],
  ["institution", "accounting.settings.secOrganisation"],
  ["contactLine", "accounting.voucherTemplate.contact"],
  ["voucherNo", "accounting.journal.voucher.voucherNo"],
  ["date", "accounting.journal.voucher.date"],
  ["fiscalYear", "accounting.journal.voucher.fiscalYear"],
  ["partyLabel", "accounting.journal.voucher.paidTo"],
  ["partyName", "accounting.journal.voucher.receiverName"],
  ["employeeIdLabel", "accounting.journal.voucher.employeeId"],
  ["employeeId", "accounting.journal.voucher.employeeId"],
  ["designationLabel", "accounting.journal.voucher.designation"],
  ["designation", "accounting.journal.voucher.designation"],
  ["payPeriodLabel", "accounting.journal.voucher.payPeriod"],
  ["payPeriod", "accounting.journal.voucher.payPeriod"],
  ["purpose", "accounting.journal.voucher.purpose"],
  ["sourceLabel", "accounting.journal.voucher.paidFrom"],
  ["sourceValue", "accounting.journal.voucher.paidFrom"],
  ["amount", "accounting.journal.voucher.total"],
  ["netPaid", "accounting.journal.voucher.netPaid"],
  ["amountInWords", "accounting.journal.voucher.amountInWords"],
  ["preparedBy", "accounting.journal.voucher.preparedBy"],
];

const SAMPLE_GROSS = 19500;
const SAMPLE_DEDUCTION = 500;

export interface VoucherTemplateSampleData {
  sampleData: VoucherPrintPayload;
  availableFields: TemplateFieldDefinition<VoucherPrintPayload>[];
}

/** Localized, branded sample salary voucher; field palette samples read from the same payload. */
export function useVoucherTemplateSampleData(
  branding: BrandingSettings,
): VoucherTemplateSampleData {
  const { t } = useTranslation();
  const { formatCurrency, activeCurrency } = useAccountingCurrency();
  const { user } = useAuth();
  const userName = user?.name ?? "";

  return useMemo(() => {
    const net = SAMPLE_GROSS - SAMPLE_DEDUCTION;
    const sampleData: VoucherPrintPayload = {
      title: t(VOUCHER_KIND_TITLE_KEY.payment),
      institution: branding.madrasaName,
      contactLine: voucherContactLine(branding),
      voucherNo: "JE-26-0034",
      date: formatDate(new Date().toISOString()),
      fiscalYear: "2025-2026",
      partyLabel: t("accounting.journal.voucher.paidTo"),
      partyName: "Zehra Haider",
      employeeIdLabel: t("accounting.journal.voucher.employeeId"),
      employeeId: "EMP-14",
      designationLabel: t("accounting.journal.voucher.designation"),
      designation: "Teacher",
      payPeriodLabel: t("accounting.journal.voucher.payPeriod"),
      payPeriod: "2026-09",
      purpose: `${t("accounting.journal.voucher.payPeriod")}: 2026-09`,
      sourceLabel: t("accounting.journal.voucher.paidFrom"),
      sourceValue: "1000 — Cash In Hand",
      lines: [
        {
          account: "1027 — Salaries payable",
          debit: formatCurrency(SAMPLE_GROSS),
          credit: "",
          amount: formatCurrency(SAMPLE_GROSS),
        },
        {
          account: `${t("accounting.journal.voucher.deduction")}: Staff Late Deduction`,
          debit: "",
          credit: formatCurrency(SAMPLE_DEDUCTION),
          amount: formatCurrency(SAMPLE_DEDUCTION),
        },
      ],
      amount: formatCurrency(SAMPLE_GROSS),
      netPaid: formatCurrency(net),
      amountInWords: formatAmountInWords(net, activeCurrency.code),
      preparedBy: userName,
      receiverName: "",
      receiverId: "",
      receiverSign: "",
      receiverDate: "",
    };
    const availableFields = FIELD_LABEL_KEYS.map(([field, labelKey]) => ({
      field,
      label: t(labelKey),
      sampleValue: sampleData[field],
    }));
    return { sampleData, availableFields };
  }, [activeCurrency.code, branding, formatCurrency, t, userName]);
}
