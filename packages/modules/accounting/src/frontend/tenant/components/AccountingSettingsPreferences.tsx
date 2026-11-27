import { type AccountingSettings, type Account, type FiscalYear } from "@mms/contracts";
import type { StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";
import { AccountingSettingsCurrencySection } from "../index";
import { AccountingSettingsFxSection } from "./AccountingSettingsFxSection";
import { AccountingSettingsHyperinflationSection } from "./AccountingSettingsHyperinflationSection";
import { AccountingSettingsFiscalYearsSection } from "./AccountingSettingsFiscalYearsSection";
import { AccountingSettingsRulesSection } from "../index";
import { AccountingSettingsTemplatesSection } from "../index";
import { AccountingSettingsNumberingSection } from "./AccountingSettingsNumberingSection";
import { AccountingSettingsPostingSection } from "../index";

type CurrencyOption = {
  code: string;
  symbol: string;
  name: string;
};

interface AccountingSettingsPreferencesProps {
  accounts: Account[];
  fiscalYears: FiscalYear[];
  settingsDraft: AccountingSettings;
  upd: <K extends keyof AccountingSettings>(field: K, value: AccountingSettings[K]) => void;
  currencies: CurrencyOption[];
  activeCurrency: CurrencyOption | undefined;
  decimalSeparators: { label: string; value: string }[];
  fyStatusConfig: Record<string, StatusBadgeConfigItem>;
  canEditSetup: boolean;
  onEditFiscalYear: (fiscalYear: Partial<FiscalYear>) => void;
  onRequestCloseFiscalYear?: (fiscalYearId: string) => void;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function AccountingSettingsPreferences({
  accounts,
  fiscalYears,
  settingsDraft,
  upd,
  currencies,
  activeCurrency,
  decimalSeparators,
  fyStatusConfig,
  canEditSetup,
  onEditFiscalYear,
  onRequestCloseFiscalYear,
  onAccountsChange: _onAccountsChange,
  isPrefsDirty,
  saving,
  saved,
  onSave,
}: AccountingSettingsPreferencesProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <AccountingSettingsCurrencySection
        settingsDraft={settingsDraft}
        upd={upd}
        currencies={currencies}
        activeCurrency={activeCurrency}
        decimalSeparators={decimalSeparators}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />

      <AccountingSettingsFxSection canEditSetup={canEditSetup} />

      <AccountingSettingsHyperinflationSection accounts={accounts} canEditSetup={canEditSetup} />

      <AccountingSettingsFiscalYearsSection
        fiscalYears={fiscalYears}
        settingsDraft={settingsDraft}
        upd={upd}
        fyStatusConfig={fyStatusConfig}
        canEditSetup={canEditSetup}
        onEditFiscalYear={onEditFiscalYear}
        onRequestCloseFiscalYear={onRequestCloseFiscalYear}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />

      <AccountingSettingsRulesSection
        accounts={accounts}
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />

      <AccountingSettingsTemplatesSection
        accounts={accounts}
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />

      <AccountingSettingsNumberingSection canEdit={canEditSetup} />
      <AccountingSettingsPostingSection accounts={accounts} />
    </div>
  );
}
