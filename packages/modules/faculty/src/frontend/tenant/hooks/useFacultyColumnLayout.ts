import { useMemo } from "react";
import {
  FACULTY_MODULE_MANIFEST,
  buildFacultyWorkColumnRegistry,
  facultyColumnLabelKey,
  facultyWorkColumnLabelsFrom,
  type FacultySettings,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModuleColumnLayout } from "@mms/fe-core/hooks/useModuleColumnLayout";

export function useFacultyColumnLayout(settings: FacultySettings) {
  const { t } = useTranslation();

  // Stable registry identity: useModuleColumnLayout memoizes the visible
  // columns on this reference, so rebuilding it every render would cascade a
  // full column-registry (and row-prop) recompute across unrelated re-renders.
  const tenantRegistry = useMemo(
    () =>
      buildFacultyWorkColumnRegistry(
        settings,
        facultyWorkColumnLabelsFrom((key) => t(facultyColumnLabelKey(key))),
      ),
    [settings, t],
  );

  const {
    customizerLabels: baseLabels,
    updateUserColumnLayout,
    ...base
  } = useModuleColumnLayout({
    moduleId: FACULTY_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: FACULTY_MODULE_MANIFEST.restBasePath,
    translationPrefix: "faculty.columns",
  });

  const customizerLabels = useMemo(
    () => ({
      ...baseLabels,
      reset: t("faculty.resetLayout"),
      searchPlaceholder: t("faculty.searchColumnsPlaceholder"),
    }),
    [baseLabels, t],
  );

  const resetColumnLayout = () => {
    updateUserColumnLayout(tenantRegistry);
  };

  return {
    ...base,
    updateUserColumnLayout,
    customizerLabels,
    resetColumnLayout,
  };
}
