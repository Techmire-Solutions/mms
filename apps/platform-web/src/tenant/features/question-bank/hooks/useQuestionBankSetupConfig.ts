import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tsrClient } from "@mms/fe-core/api/tsRest";
import type { QuestionBankSettings } from "@mms/contracts";
import {
  DEFAULT_QUESTION_BANK_SETTINGS,
  stripQuestionBankFieldConfigForPersist,
  composeQuestionBankSettings,
  normalizeQuestionBankModulePreferences,
  normalizeQuestionBankFieldConfigOnly,
} from "@mms/contracts";
import { assertContractOk } from "@mms/fe-core/api/contractError";

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

  // `mutateAsync` is the MutationObserver's bound `mutate` and stays stable for the
  // lifetime of the observer, so the update callback keeps a stable identity too —
  // `useQuestionBankConfig` memoizes on it (config object → form/section memos).
  const { mutateAsync: updateFieldsAsync } = updateFieldsMutation;
  const { mutateAsync: updatePrefsAsync } = updatePrefsMutation;

  const updateAsync = useCallback(
    async (draft: QuestionBankSettings) => {
      const fieldConfigOnly = stripQuestionBankFieldConfigForPersist(draft);
      const prefsOnly = normalizeQuestionBankModulePreferences(draft);

      const [fieldsRes, prefsRes] = await Promise.all([
        updateFieldsAsync({ body: fieldConfigOnly }),
        updatePrefsAsync({ body: prefsOnly }),
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
    },
    [queryClient, updateFieldsAsync, updatePrefsAsync],
  );

  return {
    data: (query.data?.body ?? DEFAULT_QUESTION_BANK_SETTINGS) as QuestionBankSettings,
    isLoading: query.isLoading,
    isError: query.isError,
    updateAsync,
  };
}
