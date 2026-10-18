import {
  FACULTY_MODULE_MANIFEST,
  buildFacultyWorkColumnRegistry,
  facultyColumnLabelKey,
  facultyWorkColumnLabelsFrom,
  type FacultySettings,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useFacultyColumnLayout(settings: FacultySettings) {
  const { t } = useTranslation();

  const tenantRegistry = (() =>
    buildFacultyWorkColumnRegistry(
      settings,
      facultyWorkColumnLabelsFrom((key) => t(facultyColumnLabelKey(key))),
    ))();

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

  const customizerLabels = (() => ({
    ...baseLabels,
    reset: t("faculty.resetLayout"),
    searchPlaceholder: t("faculty.searchColumnsPlaceholder"),
  }))();

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
