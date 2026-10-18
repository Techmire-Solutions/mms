import { ACCOUNTING_MODULE_MANIFEST, buildAccountingAccountWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

const STORAGE_SUFFIX = "accounts";

export function useAccountingAccountColumnLayout() {
  const { t } = useTranslation();

  const storageModuleId = `${ACCOUNTING_MODULE_MANIFEST.moduleId}_${STORAGE_SUFFIX}`;

  const tenantRegistry = (() =>
    buildAccountingAccountWorkColumnRegistry({
      code: t("accounting.columns.account.code"),
      name: t("accounting.columns.account.name"),
      type: t("accounting.columns.account.type"),
      subtype: t("accounting.columns.account.subtype"),
      description: t("accounting.columns.account.description"),
      normalBalance: t("accounting.columns.account.normalBalance"),
    }))();

  return useModuleColumnLayout({
    moduleId: storageModuleId,
    tenantRegistry,
    apiPath: `${ACCOUNTING_MODULE_MANIFEST.restBasePath}/accounts`,
    translationPrefix: "accounting.columns",
  });
}
