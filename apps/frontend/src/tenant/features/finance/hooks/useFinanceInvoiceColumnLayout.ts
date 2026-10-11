import { FINANCE_MODULE_MANIFEST, buildFinanceInvoiceWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

const STORAGE_SUFFIX = "invoices";

export function useFinanceInvoiceColumnLayout() {
  const { t } = useTranslation();

  const storageModuleId = `${FINANCE_MODULE_MANIFEST.moduleId}_${STORAGE_SUFFIX}`;

  const tenantRegistry = (() =>
    buildFinanceInvoiceWorkColumnRegistry({
      invoice: t("finance.columns.invoice"),
      student: t("finance.columns.student"),
      sessionClass: t("finance.columns.sessionClass"),
      baseFee: t("finance.columns.baseFee"),
      discount: t("finance.columns.discount"),
      final: t("finance.columns.final"),
      status: t("finance.columns.status"),
      dueDate: t("finance.columns.dueDate"),
    }))();

  return useModuleColumnLayout({
    moduleId: storageModuleId,
    tenantRegistry,
    apiPath: `${FINANCE_MODULE_MANIFEST.restBasePath}/invoices`,
    translationPrefix: "finance.columns",
  });
}
