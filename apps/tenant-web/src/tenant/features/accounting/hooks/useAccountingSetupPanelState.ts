import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_CURRENCIES,
  composeAccountingSettings,
  normalizeAccountingModulePreferences,
  type AccountingSettings,
} from "@mms/contracts";
import {
  useAccountingPreferencesMutation,
  useAccountingPreferencesQuery,
} from "@/tenant/features/accounting/hooks/useAccountingSetupConfig";
import { toAccountingPreferencesPayload } from "@/tenant/features/accounting/hooks/accountingSetupConfigApi";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useTranslation } from "@mms/fe-core/i18n";
import { SEMANTIC_BADGE } from "@mms/fe-core/ui/semanticTone";
import { notify } from "@mms/fe-core/notify";
import type { StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";
import type { FiscalYear } from "@mms/mod-accounting/frontend/tenant";
import { useAccountingSetupSaveActions } from "@/tenant/features/accounting/hooks/useAccountingSetupSaveActions";

export interface UseAccountingSetupPanelStateOptions {
  onSaveFiscalYears: (
    fiscalYears: FiscalYear[] | ((prev: FiscalYear[]) => FiscalYear[]),
  ) => void | Promise<void>;
}

export interface UseAccountingSetupPanelStateReturn {
  settingsDraft: AccountingSettings;
  upd: <K extends keyof AccountingSettings>(field: K, value: AccountingSettings[K]) => void;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saving: boolean;
  isPrefsDirty: boolean;
  isDirty: boolean;
  /**
   * False until the stored preferences have really come back from the server.
   * Saving earlier would PUT the placeholder defaults over the stored row —
   * including `retainedEarningsAccount`, which period close depends on.
   */
  isPrefsReady: boolean;
  isPrefsLoadFailed: boolean;
  handleSave: () => Promise<void>;
  decimalSeparators: { label: string; value: string }[];
  fyStatusConfig: Record<string, StatusBadgeConfigItem>;
  currencies: typeof DEFAULT_CURRENCIES;
  activeCurrency: (typeof DEFAULT_CURRENCIES)[number] | undefined;
  fyModal: Partial<FiscalYear> | null;
  setFyModal: (fy: Partial<FiscalYear> | null) => void;
  handleSaveFY: (fiscalYear: FiscalYear) => Promise<void>;
}

/**
 * Accounting Setup Preferences state.
 *
 * This panel used to read `useAccountingConfig()` — the standard-module stub
 * whose `settings` is the in-memory default and whose `updateSettingsAsync` is
 * `async () => {}`. Every Preferences save therefore resolved instantly,
 * toasted "saved", and persisted nothing: `retainedEarningsAccount` never
 * reached the server, so closing a fiscal year was impossible. It now reads the
 * real `GET`/`PUT /api/accounting/preferences` tier.
 */
export function useAccountingSetupPanelState({
  onSaveFiscalYears,
}: UseAccountingSetupPanelStateOptions): UseAccountingSetupPanelStateReturn {
  const { t } = useTranslation();
  const preferencesQuery = useAccountingPreferencesQuery();
  const preferencesMutation = useAccountingPreferencesMutation();

  const preferences = useMemo(
    () => normalizeAccountingModulePreferences(preferencesQuery.data ?? null),
    [preferencesQuery.data],
  );

  const settings = useMemo(() => composeAccountingSettings(null, preferences), [preferences]);

  /**
   * TanStack Query v5 keeps `mutate`/`mutateAsync` referentially stable across
   * renders (`mutate` is memoized on the stable observer; `mutateAsync` is the
   * observer's method), so the callbacks can depend on them directly. The
   * previous `preferencesMutationRef.current = …` write happened during render,
   * which the React Compiler forbids (refs are not render values).
   */
  const { mutate: savePreferences, mutateAsync: savePreferencesAsync } = preferencesMutation;

  const updateSettings = useCallback(
    (next: AccountingSettings): void => {
      void savePreferences(toAccountingPreferencesPayload(next));
    },
    [savePreferences],
  );

  const updateSettingsAsync = useCallback(
    async (next: AccountingSettings): Promise<void> => {
      await savePreferencesAsync(toAccountingPreferencesPayload(next));
    },
    [savePreferencesAsync],
  );

  const config = useMemo(
    () => ({ settings, updateSettings, updateSettingsAsync }),
    [settings, updateSettings, updateSettingsAsync],
  );

  const {
    settingsDraft,
    saved,
    setSaved,
    upd: editorUpd,
    saveSettingsAsync,
  } = useModuleSettingsEditor<AccountingSettings>({
    config,
  });

  // `isPlaceholderData` stays true while the query still serves the placeholder
  // defaults, so it is the honest "the stored row has been read" signal.
  const isPrefsReady = preferencesQuery.isSuccess && !preferencesQuery.isPlaceholderData;
  const isPrefsLoadFailed = preferencesQuery.isError;

  /**
   * Edits are ignored until the draft has been seeded from the server.
   *
   * `useModuleSettingsEditor` keeps a dirty draft over later server values, so
   * an edit made while the placeholder defaults were on screen would leave the
   * untouched fields holding defaults — and the next save would PUT those
   * defaults over the stored preferences.
   */
  const upd = useCallback(
    <K extends keyof AccountingSettings>(field: K, value: AccountingSettings[K]): void => {
      if (!isPrefsReady) return;
      editorUpd(field, value);
    },
    [editorUpd, isPrefsReady],
  );

  const decimalSeparators = (() => [
    { label: t("accounting.settings.decimal.period"), value: "period" },
    { label: t("accounting.settings.decimal.comma"), value: "comma" },
  ])();

  const fyStatusConfig = (() => ({
    active: { label: t("accounting.settings.fy.status.active"), cls: SEMANTIC_BADGE.successStrong },
    closed: { label: t("accounting.settings.fy.status.closed"), cls: SEMANTIC_BADGE.muted },
    upcoming: {
      label: t("accounting.settings.fy.status.upcoming"),
      cls: SEMANTIC_BADGE.infoStrong,
    },
  }))() as Record<string, StatusBadgeConfigItem>;

  const currencies = DEFAULT_CURRENCIES;
  const activeCurrency = currencies.find(
    (currencyOption) => currencyOption.code === settingsDraft.currency,
  );

  const [fyModal, setFyModal] = useState<Partial<FiscalYear> | null>(null);

  const { saving, isPrefsDirty, handleSave } = useAccountingSetupSaveActions({
    settings,
    settingsDraft,
    setSaved,
    saveSettingsAsync,
    prefsReady: isPrefsReady,
  });

  /**
   * Fiscal years go through the bulk upsert route, which is additive: it
   * upserts the rows it is given and leaves absent rows alone. It is therefore
   * only ever used to write a row here — deletion has no route at all and is
   * called out in the UI instead of being faked with a collection filter.
   */
  const handleSaveFY = async (fiscalYear: FiscalYear) => {
    await onSaveFiscalYears((prev) =>
      prev.some((fy) => fy.id === fiscalYear.id)
        ? prev.map((fy) => (fy.id === fiscalYear.id ? fiscalYear : fy))
        : [...prev, fiscalYear],
    );
    setFyModal(null);
    notify.success(t("accounting.settings.fy.saved"));
  };

  return {
    settingsDraft,
    upd,
    saved,
    setSaved,
    saving,
    isPrefsDirty,
    isDirty: isPrefsDirty,
    isPrefsReady,
    isPrefsLoadFailed,
    handleSave,
    decimalSeparators,
    fyStatusConfig,
    currencies,
    activeCurrency,
    fyModal,
    setFyModal,
    handleSaveFY,
  };
}
