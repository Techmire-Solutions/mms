import { EXAMINATIONS_MODULE_MANIFEST, buildExaminationExamWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

const STORAGE_SUFFIX = "exams";

export function useExaminationExamColumnLayout() {
  const { t } = useTranslation();

  const storageModuleId = `${EXAMINATIONS_MODULE_MANIFEST.moduleId}_${STORAGE_SUFFIX}`;

  const tenantRegistry = (() =>
    buildExaminationExamWorkColumnRegistry({
      name: t("examinations.columns.exam.name"),
      subject: t("examinations.columns.exam.subject"),
      date: t("examinations.columns.exam.date"),
      duration: t("examinations.columns.exam.duration"),
      status: t("examinations.columns.exam.status"),
      totalMarks: t("examinations.columns.exam.totalMarks"),
      passingMarks: t("examinations.columns.exam.passingMarks"),
      classes: t("examinations.columns.exam.classes"),
      description: t("examinations.columns.exam.description"),
    }))();

  return useModuleColumnLayout({
    moduleId: storageModuleId,
    tenantRegistry,
    apiPath: `${EXAMINATIONS_MODULE_MANIFEST.restBasePath}/exams`,
    translationPrefix: "examinations.columns",
  });
}
