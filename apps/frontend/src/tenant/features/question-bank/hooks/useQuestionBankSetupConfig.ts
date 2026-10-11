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

const QUERY_KEY_COMPOSED = ["question-bank", "config", "composed"] as const;
const QUERY_KEY_FIELDS = ["question-bank", "config", "fields"] as const;
const QUERY_KEY_PREFS = ["question-bank", "config", "preferences"] as const;

export function useComposedQuestionBankSettings() {
  const queryClient = useQueryClient();

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const query = tsrClient.questionBank.getComposedConfig.useQuery({
    queryKey: QUERY_KEY_COMPOSED,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const updateFieldsMutation = tsrClient.questionBank.updateFieldConfig.useMutation();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  const updatePrefsMutation = tsrClient.questionBank.updatePreferences.useMutation();

  const updateAsync = async (draft: QuestionBankSettings) => {
    const fieldConfigOnly = stripQuestionBankFieldConfigForPersist(draft);
    const prefsOnly = normalizeQuestionBankModulePreferences(draft);

    const [fieldsRes, prefsRes] = await Promise.all([
      updateFieldsMutation.mutateAsync({ body: fieldConfigOnly }),
      updatePrefsMutation.mutateAsync({ body: prefsOnly }),
    ]);

    if (fieldsRes.status !== 200 || prefsRes.status !== 200) {
      throw new Error("Failed to update question bank settings");
    }

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
