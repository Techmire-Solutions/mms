import { useMemo } from "react";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  buildExaminationExamWorkColumnRegistry,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModuleColumnLayout } from "@mms/fe-core/hooks/useModuleColumnLayout";

const STORAGE_SUFFIX = "exams";

export function useExaminationExamColumnLayout() {
  const { t } = useTranslation();

  const storageModuleId = `${EXAMINATIONS_MODULE_MANIFEST.moduleId}_${STORAGE_SUFFIX}`;

  const tenantRegistry = useMemo(
    () =>
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
      }),
    [t],
  );

  return useModuleColumnLayout({
    moduleId: storageModuleId,
    tenantRegistry,
    apiPath: `${EXAMINATIONS_MODULE_MANIFEST.restBasePath}/exams`,
    translationPrefix: "examinations.columns",
  });
}
