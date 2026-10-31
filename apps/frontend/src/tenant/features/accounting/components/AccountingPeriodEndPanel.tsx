import type React from "react";
import type { Account, FiscalYear } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import type { MoneySeparator } from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import { useAccountingCurrencySettings } from "@/tenant/features/accounting/hooks/useAccountingFx";
import { AccountingSettingsExchangeRatesSection } from "./AccountingSettingsExchangeRatesSection";
import { AccountingFxRevaluationSection } from "./AccountingFxRevaluationSection";
import { AccountingIas29Panel } from "./AccountingIas29Panel";
import { AccountingHedgesSection } from "./AccountingHedgesSection";
import { AccountingOpeningSection } from "./AccountingOpeningSection";

export interface AccountingPeriodEndPanelProps {
  accounts: Account[];
  fiscalYears: FiscalYear[];
  decimalSeparator: MoneySeparator;
  canWrite: boolean;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
}

/**
 * Period-end tab on the Accounting tier: exchange rates, FX revaluation,
 * IAS 29 restatement (when enabled), hedges, and opening balances.
 */
export function AccountingPeriodEndPanel({
  accounts,
  fiscalYears,
  decimalSeparator,
  canWrite,
  onAccountsChange,
}: AccountingPeriodEndPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const currencySettings = useAccountingCurrencySettings();

  const functionalCurrency = currencySettings.data?.functionalCurrency ?? "";
  const enabledCurrencies = currencySettings.data?.enabledCurrencies ?? [];

  return (
    <div className="space-y-6">
      <p className="m-0 text-xs text-muted-foreground text-pretty">
        {t("accounting.periodEnd.hint")}
      </p>

      <AccountingSettingsExchangeRatesSection
        functionalCurrency={functionalCurrency}
        enabledCurrencies={enabledCurrencies}
        canEdit={canWrite}
      />

      <AccountingFxRevaluationSection canEdit={canWrite} />

      <AccountingIas29Panel canEdit={canWrite} />

      <AccountingHedgesSection accounts={accounts} canEdit={canWrite} />

      <AccountingOpeningSection
        accounts={accounts}
        fiscalYears={fiscalYears}
        decimalSeparator={decimalSeparator}
        canEdit={canWrite}
        onAccountsChange={onAccountsChange}
      />
    </div>
  );
}
