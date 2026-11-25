import { useMemo } from "react";
import {
  OBLIGATIONS_MODULE_MANIFEST,
  buildObligationCollectionWorkColumnRegistry,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModuleColumnLayout } from "@mms/fe-core/hooks/useModuleColumnLayout";

export function useObligationColumnLayout() {
  const { t } = useTranslation();

  const tenantRegistry = useMemo(
    () =>
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
      }),
    [t],
  );

  return useModuleColumnLayout({
    moduleId: OBLIGATIONS_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: OBLIGATIONS_MODULE_MANIFEST.restBasePath,
    translationPrefix: "obligations.columns",
  });
}
