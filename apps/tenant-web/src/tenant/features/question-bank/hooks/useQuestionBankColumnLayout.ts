import { useMemo } from "react";
import { QUESTION_BANK_MODULE_MANIFEST, buildQuestionBankWorkColumnRegistry } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModuleColumnLayout } from "@mms/fe-core/hooks/useModuleColumnLayout";

export function useQuestionBankColumnLayout() {
  const { t } = useTranslation();

  // Stable registry identity: useModuleColumnLayout memoizes the applied column
  // registry (and the isColumnVisible/getColumnWidth callbacks) on it, which keeps
  // DataTable row props stable across unrelated re-renders.
  const tenantRegistry = useMemo(
    () =>
      buildQuestionBankWorkColumnRegistry({
        text: t("questionBank.columns.text"),
        category: t("questionBank.columns.category"),
        language: t("questionBank.columns.language"),
        type: t("questionBank.columns.type"),
        difficulty: t("questionBank.columns.difficulty"),
        source: t("questionBank.columns.source"),
      }),
    [t],
  );

  return useModuleColumnLayout({
    moduleId: QUESTION_BANK_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: QUESTION_BANK_MODULE_MANIFEST.restBasePath,
    translationPrefix: "questionBank.columns",
  });
}
