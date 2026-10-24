import { HASANAT_MODULE_MANIFEST, buildHasanatRedemptionWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

const STORAGE_SUFFIX = "redemptions";

export function useHasanatRedemptionColumnLayout() {
  const { t } = useTranslation();

  const storageModuleId = `${HASANAT_MODULE_MANIFEST.moduleId}_${STORAGE_SUFFIX}`;

  const tenantRegistry = (() =>
    buildHasanatRedemptionWorkColumnRegistry({
      student: t("hasanat.columns.redemption.student"),
      reward: t("hasanat.columns.redemption.reward"),
      pointsUsed: t("hasanat.columns.redemption.pointsUsed"),
      date: t("hasanat.columns.redemption.date"),
      approvedBy: t("hasanat.columns.redemption.approvedBy"),
    }))();

  return useModuleColumnLayout({
    moduleId: storageModuleId,
    tenantRegistry,
    apiPath: `${HASANAT_MODULE_MANIFEST.restBasePath}/redemptions`,
    translationPrefix: "hasanat.columns",
  });
}
