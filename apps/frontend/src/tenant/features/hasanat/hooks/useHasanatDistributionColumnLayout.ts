import { HASANAT_MODULE_MANIFEST, buildHasanatDistributionWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

const STORAGE_SUFFIX = "distributions";

export function useHasanatDistributionColumnLayout() {
  const { t } = useTranslation();

  const storageModuleId = `${HASANAT_MODULE_MANIFEST.moduleId}_${STORAGE_SUFFIX}`;

  const tenantRegistry = (() =>
    buildHasanatDistributionWorkColumnRegistry({
      card: t("hasanat.columns.distribution.card"),
      recipient: t("hasanat.columns.distribution.recipient"),
      recipientType: t("hasanat.columns.distribution.recipientType"),
      recipientClass: t("hasanat.columns.distribution.recipientClass"),
      quantity: t("hasanat.columns.distribution.quantity"),
      reason: t("hasanat.columns.distribution.reason"),
      issuedDate: t("hasanat.columns.distribution.issuedDate"),
      issuedBy: t("hasanat.columns.distribution.issuedBy"),
      status: t("hasanat.columns.distribution.status"),
    }))();

  return useModuleColumnLayout({
    moduleId: storageModuleId,
    tenantRegistry,
    apiPath: `${HASANAT_MODULE_MANIFEST.restBasePath}/distributions`,
    translationPrefix: "hasanat.columns",
  });
}
