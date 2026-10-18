import { USERS_MODULE_MANIFEST, buildUsersWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useUserColumnLayout() {
  const { t } = useTranslation();

  const tenantRegistry = (() =>
    buildUsersWorkColumnRegistry({
      user: t("users.colUser"),
      email: t("users.fieldContactEmail"),
      role: t("users.colRole"),
      status: t("users.colStatus"),
      lastLogin: t("users.colLastLogin"),
      created: t("users.colCreated"),
      twoFactor: t("users.col2fa"),
    }))();

  return useModuleColumnLayout({
    moduleId: USERS_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: USERS_MODULE_MANIFEST.restBasePath,
    translationPrefix: "users.columns",
  });
}
