import React, { useEffect, useState } from "react";
import type { Account, FiscalYear } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { WarningCallout } from "@/components/app/WarningCallout";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { AccountingFiscalYearModal } from "./AccountingFiscalYearModal";
import { AccountingSettingsPreferences } from "./AccountingSettingsPreferences";
import { useAccountingSetupPanelState } from "@/tenant/features/accounting/hooks/useAccountingSetupPanelState";
import { CloseFiscalYearModal } from "./CloseFiscalYearModal";
import { ModuleSetupContent } from "@/components/app/ModuleSetupContent";

export interface AccountingSettingsProps {
  accounts: Account[];
  fiscalYears: FiscalYear[];
  onSaveFiscalYears: (
    fiscalYears: FiscalYear[] | ((prev: FiscalYear[]) => FiscalYear[]),
  ) => void | Promise<void>;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const AccountingSettings = function AccountingSettings({
  accounts,
  fiscalYears,
  onSaveFiscalYears,
  onAccountsChange,
  onPrefsDirtyChange,
}: AccountingSettingsProps) {
  const { t } = useTranslation();

  const {
    settingsDraft,
    upd,
    saved,
    saving,
    isPrefsDirty,
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
  } = useAccountingSetupPanelState({
    onSaveFiscalYears,
  });

  const [closeTarget, setCloseTarget] = useState<FiscalYear | null>(null);

  const handleRequestCloseFiscalYear = (fiscalYearId: string): void => {
    const target = fiscalYears.find((year) => year.id === fiscalYearId);
    if (!target || target.status === "closed") return;
    setCloseTarget(target);
  };

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);

  const unsavedWarning = isPrefsDirty ? t("accounting.setup.unsavedPreferencesWarning") : undefined;

  return (
    <ModuleSetupContent>
      {!isPrefsReady && (
        <WarningCallout
          role="alert"
          tone={isPrefsLoadFailed ? "destructive" : "info"}
          description={
            isPrefsLoadFailed
              ? t("accounting.settings.prefsLoadFailed")
              : t("accounting.settings.prefsLoading")
          }
        />
      )}

      <AccountingSettingsPreferences
        accounts={accounts}
        fiscalYears={fiscalYears}
        settingsDraft={settingsDraft}
        upd={upd}
        currencies={currencies}
        activeCurrency={activeCurrency}
        decimalSeparators={decimalSeparators}
        fyStatusConfig={fyStatusConfig}
        canEditSetup={true}
        onEditFiscalYear={setFyModal}
        onRequestCloseFiscalYear={handleRequestCloseFiscalYear}
        onAccountsChange={onAccountsChange}
        isPrefsDirty={isPrefsDirty && isPrefsReady}
        saving={saving}
        saved={saved}
        onSave={handleSave}
      />

      <ModuleSetupSaveFooter
        dirty={isPrefsDirty && isPrefsReady}
        saving={saving}
        saved={saved}
        unsavedWarning={unsavedWarning}
        saveLabel={t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={handleSave}
      />

      <AccountingFiscalYearModal
        open={Boolean(fyModal)}
        initial={fyModal}
        onSave={handleSaveFY}
        onClose={() => setFyModal(null)}
        onRequestClose={(fiscalYearId) => {
          setFyModal(null);
          handleRequestCloseFiscalYear(fiscalYearId);
        }}
      />

      <CloseFiscalYearModal
        closeTarget={closeTarget}
        accounts={accounts}
        preferredRetainedEarningsAccount={settingsDraft.retainedEarningsAccount}
        onClose={() => setCloseTarget(null)}
        onCloseSuccess={async (updatedYear) => {
          await onSaveFiscalYears((prev) =>
            prev.map((year) => (year.id === updatedYear.id ? updatedYear : year)),
          );
        }}
        t={t}
      />
    </ModuleSetupContent>
  );
};

export default AccountingSettings;
