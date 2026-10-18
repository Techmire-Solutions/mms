import {
  OBLIGATIONS_MODULE_MANIFEST,
  buildObligationCollectionWorkColumnRegistry,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useObligationColumnLayout() {
  const { t } = useTranslation();

  const tenantRegistry = (() =>
    buildObligationCollectionWorkColumnRegistry({
      receiptNo: t("obligations.columns.receiptNo"),
      receivedDate: t("obligations.columns.receivedDate"),
      sender: t("obligations.columns.sender"),
      obligationType: t("obligations.columns.obligationType"),
      repMujtahid: t("obligations.columns.repMujtahid"),
      amount: t("obligations.columns.amount"),
      paymentMode: t("obligations.columns.paymentMode"),
      reference: t("obligations.columns.reference"),
      currency: t("obligations.columns.currency"),
      receivedBy: t("obligations.columns.receivedBy"),
    }))();

  return useModuleColumnLayout({
    moduleId: OBLIGATIONS_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: OBLIGATIONS_MODULE_MANIFEST.restBasePath,
    translationPrefix: "obligations.columns",
  });
}
