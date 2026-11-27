import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatAmountInWords, formatDate, getPageDimensions } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useAccountingCurrency } from "./useAccountingCurrency";

import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { notify } from "@mms/fe-core/notify";
import { buildPrintWindowHtml, autoPrintWindow } from "@mms/fe-core/print/printWindowHtml";
import { getScopedBrandingSettings } from "@mms/fe-core/lib/settingsPreviewStore";
import { useDocumentTemplate } from "@mms/fe-core/documentTemplates/useDocumentTemplates";
import type { Account, JournalEntry } from "../index";
import { facultyResolveQueryOptions } from "../host/facultyCollection";
import { VOUCHER_KIND_TITLE_KEY, voucherPreparerName } from "../index";
import { buildPaymentVoucherModel, type SalaryVoucherRef } from "../index";
import type { PaymentVoucherPrintInput } from "../lib/paymentVoucherHtml";
import {
  ACCOUNTING_VOUCHER_TEMPLATE_KEY,
  voucherContactLine,
  voucherTableLines,
  type VoucherPrintPayload,
} from "../lib/voucherTemplateModel";
import { buildVoucherTemplate, voucherLayoutCopy } from "../lib/voucherTemplateLayout";
import { buildVoucherTemplateHtml } from "../lib/voucherTemplateHtml";

type Payee = PaymentVoucherPrintInput["payee"];

/**
 * Prints a voucher for any posted journal entry. Salary payments resolve the
 * staff member's name; other payees stay blank to be filled in by hand.
 * Prepared By is the user who entered the voucher.
 */
export function usePaymentVoucherPrint(accounts: readonly Account[]) {
  const { t, language, isRtl } = useTranslation();
  const { formatCurrency, activeCurrency } = useAccountingCurrency();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // The layout is a server-backed document template; the factory layout is only the
  // fallback while the query resolves.
  const defaultTemplate = useMemo(() => buildVoucherTemplate("A6", voucherLayoutCopy(t)), [t]);
  const { template } = useDocumentTemplate<VoucherPrintPayload>(
    ACCOUNTING_VOUCHER_TEMPLATE_KEY,
    defaultTemplate,
  );

  const resolvePayee = useCallback(
    async (salary: SalaryVoucherRef | null): Promise<Payee> => {
      if (!salary) return null;
      try {
        const faculty = await queryClient.fetchQuery(facultyResolveQueryOptions([salary.staffId]));
        const member = faculty?.find((candidate) => String(candidate.id) === salary.staffId);
        if (!member?.name) return null;
        return {
          name: member.name,
          employeeId: member.employeeId ?? "",
          designation: member.designation ?? "",
        };
      } catch {
        // Lookup failure is non-fatal: the voucher still prints with a blank payee line to fill by hand.
        return null;
      }
    },
    [queryClient],
  );

  return useCallback(
    async (entry: JournalEntry): Promise<void> => {
      const page = getPageDimensions(template.pageSize, template.orientation ?? "portrait");
      // Open synchronously inside the click so popup blockers allow it; content is written after the payee lookup.
      const printWindow = window.open(
        "",
        "_blank",
        `width=${page.width + 80},height=${page.height + 120}`,
      );
      if (!printWindow) {
        notify.error(t("accounting.journal.voucher.popupBlocked"));
        return;
      }
      printWindow.opener = null;
      const model = buildPaymentVoucherModel(entry, accounts);
      const payee = await resolvePayee(model.salary);
      const branding = getScopedBrandingSettings();
      const title = t(VOUCHER_KIND_TITLE_KEY[model.kind]);
      const spokenAmount = model.deductions.length > 0 ? model.netAmount : model.amount;
      const data: VoucherPrintPayload = {
        title,
        institution: branding.madrasaName,
        contactLine: voucherContactLine(branding),
        voucherNo: entry.ref || entry.id,
        date: formatDate(entry.date),
        fiscalYear: entry.fiscal_year,
        partyLabel:
          model.layout === "journal"
            ? ""
            : t(
                model.layout === "receipt"
                  ? "accounting.journal.voucher.receivedFrom"
                  : "accounting.journal.voucher.paidTo",
              ),
        partyName: payee?.name ?? "",
        employeeIdLabel: payee ? t("accounting.journal.voucher.employeeId") : "",
        employeeId: payee?.employeeId ?? "",
        designationLabel: payee ? t("accounting.journal.voucher.designation") : "",
        designation: payee?.designation ?? "",
        payPeriodLabel: model.salary ? t("accounting.journal.voucher.payPeriod") : "",
        payPeriod: model.salary?.payPeriod ?? "",
        purpose: entry.description,
        sourceLabel:
          model.layout === "journal"
            ? ""
            : t(
                model.layout === "receipt"
                  ? "accounting.journal.voucher.receivedIn"
                  : "accounting.journal.voucher.paidFrom",
              ),
        sourceValue: model.paidFrom.join(", "),
        lines: voucherTableLines(model, formatCurrency, t("accounting.journal.voucher.deduction")),
        amount: formatCurrency(model.amount),
        netPaid: formatCurrency(model.netAmount),
        amountInWords: formatAmountInWords(spokenAmount, activeCurrency.code),
        preparedBy: voucherPreparerName(entry.created_by, user?.name ?? ""),
        receiverName: "",
        receiverId: "",
        receiverSign: "",
        receiverDate: "",
      };

      printWindow.document.write(
        buildPrintWindowHtml({
          windowTitle: t("accounting.journal.voucher.windowTitle", {
            title,
            ref: entry.ref || entry.id,
          }),
          language: language || "en",
          direction: isRtl ? "rtl" : "ltr",
          width: page.width,
          height: page.height,
          orientation: template.orientation || "portrait",
          bodyContent: buildVoucherTemplateHtml({
            template,
            data,
            logoUrl: branding.logoUrl,
            direction: isRtl ? "rtl" : "ltr",
          }),
        }),
      );
      printWindow.document.close();
      autoPrintWindow(printWindow);
    },
    [
      accounts,
      activeCurrency.code,
      formatCurrency,
      isRtl,
      language,
      resolvePayee,
      t,
      template,
      user?.name,
    ],
  );
}
