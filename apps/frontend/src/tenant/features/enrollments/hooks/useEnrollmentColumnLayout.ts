import { useMemo } from "react";
import { ENROLLMENTS_MODULE_MANIFEST, buildEnrollmentWorkColumnRegistry } from "@mms/contracts";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useEnrollmentColumnLayout() {
  const { t } = useTranslation();

  // Stable registry identity keeps useModuleColumnLayout's memoized `columnRegistry`
  // (and the DataTable row props derived from it) stable across unrelated re-renders.
  const tenantRegistry = useMemo(
    () =>
      buildEnrollmentWorkColumnRegistry({
        student: t("enrollments.columns.student"),
        session: t("enrollments.columns.session"),
        class: t("enrollments.columns.class"),
        enrolledDate: t("enrollments.columns.enrolledDate"),
        finalFee: t("enrollments.columns.finalFee"),
        status: t("enrollments.columns.status"),
        payment: t("enrollments.columns.payment"),
        notes: t("enrollments.columns.notes"),
      }),
    [t],
  );

  return useModuleColumnLayout({
    moduleId: ENROLLMENTS_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: ENROLLMENTS_MODULE_MANIFEST.restBasePath,
    translationPrefix: "enrollments.columns",
  });
}
