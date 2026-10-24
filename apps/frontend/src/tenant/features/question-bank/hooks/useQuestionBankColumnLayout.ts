import { QUESTION_BANK_MODULE_MANIFEST, buildQuestionBankWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useQuestionBankColumnLayout() {
  const { t } = useTranslation();

  const tenantRegistry = (() =>
    buildQuestionBankWorkColumnRegistry({
      text: t("questionBank.columns.text"),
      category: t("questionBank.columns.category"),
      language: t("questionBank.columns.language"),
      type: t("questionBank.columns.type"),
      difficulty: t("questionBank.columns.difficulty"),
      source: t("questionBank.columns.source"),
    }))();

  return useModuleColumnLayout({
    moduleId: QUESTION_BANK_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: QUESTION_BANK_MODULE_MANIFEST.restBasePath,
    translationPrefix: "questionBank.columns",
  });
}
