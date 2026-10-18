import { SESSIONS_MODULE_MANIFEST, buildSessionWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useSessionColumnLayout() {
  const { t } = useTranslation();

  const tenantRegistry = (() =>
    buildSessionWorkColumnRegistry({
      name: t("sessions.columns.name"),
      type: t("sessions.columns.type"),
      startDate: t("sessions.columns.startDate"),
      endDate: t("sessions.columns.endDate"),
      duration: t("sessions.columns.duration"),
      fee: t("sessions.columns.fee"),
      currency: t("sessions.columns.currency"),
      enrolled: t("sessions.columns.enrolled"),
      status: t("sessions.columns.status"),
      description: t("sessions.columns.description"),
    }))();

  return useModuleColumnLayout({
    moduleId: SESSIONS_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: SESSIONS_MODULE_MANIFEST.restBasePath,
    translationPrefix: "sessions.columns",
  });
}
