import { useCallback, useMemo } from "react";
import {
  ACCOUNTING_MODULE_MANIFEST,
  buildSeedJournalTemplates,
  normalizeAccountingModulePreferences,
  type Account,
  type JournalTemplate,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import {
  useAccountingPreferencesMutation,
  useAccountingPreferencesQuery,
} from "@/tenant/features/accounting/hooks/useAccountingSetupConfig";

/**
 * Saved journal entry templates plus a one-click seeder for workspaces that have
 * none yet. Seeding writes straight to preferences, so it is offered only to
 * users who may edit Accounting Setup and only once preferences have loaded.
 */
export function useJournalTemplates(accounts: readonly Account[]) {
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(ACCOUNTING_MODULE_MANIFEST);
  const preferencesQuery = useAccountingPreferencesQuery();
  const preferencesMutation = useAccountingPreferencesMutation();
  const isReady = preferencesQuery.isSuccess && !preferencesQuery.isPlaceholderData;

  const templates: JournalTemplate[] = useMemo(
    () =>
      normalizeAccountingModulePreferences(preferencesQuery.data ?? null).journalTemplates ?? [],
    [preferencesQuery.data],
  );

  const seedTemplates = useCallback(async (): Promise<void> => {
    const preferences = normalizeAccountingModulePreferences(preferencesQuery.data ?? null);
    try {
      await preferencesMutation.mutateAsync({
        ...preferences,
        journalTemplates: buildSeedJournalTemplates(accounts, t),
      });
      notify.success(t("accounting.templates.seeded"));
    } catch (error: unknown) {
      notify.error(t("errors.module.title"), {
        description: error instanceof Error ? error.message : t("errors.module.description"),
      });
    }
  }, [accounts, preferencesMutation, preferencesQuery.data, t]);

  return {
    templates,
    canSeed: canEditSetup && isReady && templates.length === 0,
    seeding: preferencesMutation.isPending,
    seedTemplates,
  };
}
