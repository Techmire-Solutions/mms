import {
  EXAMINATIONS_MODULE_MANIFEST,
  buildExaminationResultsWorkColumnRegistry,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

const STORAGE_SUFFIX = "results";

export function useExaminationResultsColumnLayout() {
  const { t } = useTranslation();

  const storageModuleId = `${EXAMINATIONS_MODULE_MANIFEST.moduleId}_${STORAGE_SUFFIX}`;

  const tenantRegistry = (() =>
    buildExaminationResultsWorkColumnRegistry({
      rank: t("examinations.columns.results.rank"),
      student: t("examinations.columns.results.student"),
      classRoll: t("examinations.columns.results.classRoll"),
      marks: t("examinations.columns.results.marks"),
      percentage: t("examinations.columns.results.percentage"),
      grade: t("examinations.columns.results.grade"),
      passFail: t("examinations.columns.results.passFail"),
    }))();

  return useModuleColumnLayout({
    moduleId: storageModuleId,
    tenantRegistry,
    apiPath: `${EXAMINATIONS_MODULE_MANIFEST.restBasePath}/results`,
    translationPrefix: "examinations.columns",
  });
}
