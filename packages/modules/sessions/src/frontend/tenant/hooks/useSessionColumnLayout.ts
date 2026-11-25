import { useMemo } from "react";
import { SESSIONS_MODULE_MANIFEST, buildSessionWorkColumnRegistry } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModuleColumnLayout } from "@mms/fe-core/hooks/useModuleColumnLayout";

export function useSessionColumnLayout() {
  const { t } = useTranslation();

  // Stable registry identity keeps useModuleColumnLayout's memoized columnRegistry (and the
  // DataTable row props derived from it) stable across unrelated re-renders.
  const tenantRegistry = useMemo(
    () =>
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
      }),
    [t],
  );

  return useModuleColumnLayout({
    moduleId: SESSIONS_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: SESSIONS_MODULE_MANIFEST.restBasePath,
    translationPrefix: "sessions.columns",
  });
}
