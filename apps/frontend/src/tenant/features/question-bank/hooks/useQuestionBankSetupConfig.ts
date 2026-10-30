import { useQueryClient } from "@tanstack/react-query";
import { tsrClient } from "@/lib/api";
import type { QuestionBankSettings } from "@mms/shared";
import {
  DEFAULT_QUESTION_BANK_SETTINGS,
  stripQuestionBankFieldConfigForPersist,
  composeQuestionBankSettings,
  normalizeQuestionBankModulePreferences,
  normalizeQuestionBankFieldConfigOnly,
} from "@mms/shared";
import { assertContractOk } from "@/lib/apiContractError";

const QUERY_KEY_COMPOSED = ["question-bank", "config", "composed"] as const;
const QUERY_KEY_FIELDS = ["question-bank", "config", "fields"] as const;
const QUERY_KEY_PREFS = ["question-bank", "config", "preferences"] as const;

export function useComposedQuestionBankSettings() {
  const queryClient = useQueryClient();

  const query = tsrClient.questionBank.getComposedConfig.useQuery({
    queryKey: QUERY_KEY_COMPOSED,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const updateFieldsMutation = tsrClient.questionBank.updateFieldConfig.useMutation();
  const updatePrefsMutation = tsrClient.questionBank.updatePreferences.useMutation();

  const updateAsync = async (draft: QuestionBankSettings) => {
    const fieldConfigOnly = stripQuestionBankFieldConfigForPersist(draft);
    const prefsOnly = normalizeQuestionBankModulePreferences(draft);

    const [fieldsRes, prefsRes] = await Promise.all([
      updateFieldsMutation.mutateAsync({ body: fieldConfigOnly }),
      updatePrefsMutation.mutateAsync({ body: prefsOnly }),
    ]);

    assertContractOk(fieldsRes, "Failed to update question bank settings");
    assertContractOk(prefsRes, "Failed to update question bank settings");

    const composedSettings = composeQuestionBankSettings(
      normalizeQuestionBankFieldConfigOnly(fieldsRes.body),
      normalizeQuestionBankModulePreferences(prefsRes.body),
    );

    queryClient.setQueryData(QUERY_KEY_COMPOSED, composedSettings);

    // Update the individual cached slices if they exist
    const newFieldConfigOnly = stripQuestionBankFieldConfigForPersist(composedSettings);
    const newPrefsOnly = normalizeQuestionBankModulePreferences(composedSettings);
    queryClient.setQueryData(QUERY_KEY_FIELDS, newFieldConfigOnly);
    queryClient.setQueryData(QUERY_KEY_PREFS, newPrefsOnly);

    return composedSettings;
  };
  return {
    data: (query.data?.body ?? DEFAULT_QUESTION_BANK_SETTINGS) as QuestionBankSettings,
    isLoading: query.isLoading,
    isError: query.isError,
    updateAsync,
  };
}
