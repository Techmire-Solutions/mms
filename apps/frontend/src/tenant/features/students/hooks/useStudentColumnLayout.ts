import {
  STUDENTS_MODULE_MANIFEST,
  buildStudentWorkColumnRegistry,
  type StudentsSettings,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useStudentColumnLayout(settings: StudentsSettings) {
  const { t } = useTranslation();

  const tenantRegistry = (() =>
    buildStudentWorkColumnRegistry(settings, {
      name: t("students.columns.name"),
      grNumber: t("students.columns.grNumber"),
      gender: t("students.columns.gender"),
      phone: t("students.columns.phone"),
      email: t("students.columns.email"),
      dob: t("students.columns.dob"),
      parents: t("students.columns.parents"),
      status: t("students.columns.status"),
      registeredDate: t("students.columns.registeredDate"),
      notes: t("students.columns.notes"),
    }))();

  const {
    customizerLabels: baseLabels,
    updateUserColumnLayout,
    ...base
  } = useModuleColumnLayout({
    moduleId: STUDENTS_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: STUDENTS_MODULE_MANIFEST.restBasePath,
    translationPrefix: "students.columns",
  });

  const customizerLabels = (() => ({
    ...baseLabels,
    reset: t("students.resetLayout"),
    searchPlaceholder: t("students.searchColumnsPlaceholder"),
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
