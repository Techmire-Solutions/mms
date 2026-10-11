import { USERS_MODULE_MANIFEST, buildUsersActivityWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

const STORAGE_SUFFIX = "activity";

export function useUserActivityColumnLayout() {
  const { t } = useTranslation();

  const tenantRegistry = (() =>
    buildUsersActivityWorkColumnRegistry({
      time: t("users.activityColTime"),
      user: t("users.activityColUser"),
      action: t("users.activityColAction"),
      detail: t("users.activityColDetail"),
      ip: t("users.activityColIp"),
    }))();

  return useModuleColumnLayout({
    moduleId: `${USERS_MODULE_MANIFEST.moduleId}_${STORAGE_SUFFIX}`,
    tenantRegistry,
    // Activity widths stay local until a dedicated prefs route exists.
    translationPrefix: "users.columns",
  });
}
