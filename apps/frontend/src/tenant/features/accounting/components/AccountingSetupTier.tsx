import React, { lazy, Suspense } from "react";
import { ACCOUNTING_MODULE_MANIFEST, type Account, type FiscalYear } from "@mms/shared";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/ui/SetupReadOnlyMessage";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";
import { ModulePanelSuspenseFallback } from "@/components/ui/ModulePanelSuspenseFallback";

const AccountingSettings = lazy(
  () => import("@/tenant/features/accounting/components/AccountingSettings"),
);

const AccountingVoucherTemplateEditor = lazy(
  () => import("@/tenant/features/accounting/components/AccountingVoucherTemplateEditor"),
);

export interface AccountingSetupTierProps {
  accounts: Account[];
  fiscalYears: FiscalYear[];
  onSaveFiscalYears: (
    updater: FiscalYear[] | ((prev: FiscalYear[]) => FiscalYear[]),
  ) => void | Promise<void>;
  onAccountsChange?: (updater: Account[] | ((prev: Account[]) => Account[])) => Promise<void> | void;
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const AccountingSetupTier = (function AccountingSetupTier({
  accounts,
  fiscalYears,
  onSaveFiscalYears,
  onAccountsChange,
  onPrefsDirtyChange,
}: AccountingSetupTierProps): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(ACCOUNTING_MODULE_MANIFEST);
  const subTabs = useModuleSetupSubTabs({
    initialKey: "preferences",
    isDirty: () => false,
    onDiscard: () => {},
  });
  const tabs = [
    { key: "preferences", label: t("accounting.setup.preferences") },
    { key: "templates", label: t("accounting.setup.templates") },
  ];

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          <SubTabBar tabs={tabs} value={subTabs.sub} onChange={subTabs.handleSubTabChange} />
          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("accounting.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              {subTabs.sub === "preferences" && (
                <AccountingSettings
                  accounts={accounts}
                  fiscalYears={fiscalYears}
                  onSaveFiscalYears={onSaveFiscalYears}
                  onAccountsChange={onAccountsChange}
                  onPrefsDirtyChange={onPrefsDirtyChange}
                />
              )}
              {subTabs.sub === "templates" && (
                <AccountingVoucherTemplateEditor onClose={() => subTabs.handleSubTabChange("preferences")} />
              )}
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
});

export default AccountingSetupTier;
