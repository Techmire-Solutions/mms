import React, { lazy, Suspense } from "react";
import { FINANCE_MODULE_MANIFEST } from "@mms/shared";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/app/SetupReadOnlyMessage";
import { SubTabBar } from "@/components/app/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";
import { ModulePanelSuspenseFallback } from "@/components/app/ModulePanelSuspenseFallback";

const FinanceSettings = lazy(() => import("@/tenant/features/finance/components/FinanceSettings"));

const FinanceTemplateEditor = lazy(
  () => import("@/tenant/features/finance/components/FinanceTemplateEditor"),
);

export interface FinanceSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const FinanceSetupTier = function FinanceSetupTier({
  onPrefsDirtyChange,
}: FinanceSetupTierProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(FINANCE_MODULE_MANIFEST);

  const subTabs = useModuleSetupSubTabs({
    initialKey: "preferences",
    isDirty: () => false,
    onDiscard: () => {},
    onChange: () => {},
  });

  const tabs = [
    { key: "preferences", label: t("finance.setup.preferences") },
    { key: "templates", label: t("finance.setup.templates") },
  ];

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          <SubTabBar tabs={tabs} value={subTabs.sub} onChange={subTabs.handleSubTabChange} />

          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("finance.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              {subTabs.sub === "preferences" && (
                <FinanceSettings onPrefsDirtyChange={onPrefsDirtyChange} />
              )}
              {subTabs.sub === "templates" && <FinanceTemplateEditor />}
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default FinanceSetupTier;
