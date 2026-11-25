import React, { lazy, Suspense } from "react";
import { FINANCE_MODULE_MANIFEST } from "@mms/contracts";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@mms/ui/app/SetupReadOnlyMessage";
import { SubTabBar } from "@mms/ui/app/SubTabBar";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModulePermissions } from "../host/usePermissions";
import { useModuleSetupSubTabs } from "@mms/fe-core/hooks/useModuleSetupSubTabs";
import { useTemplateDraftGuard } from "@mms/fe-core/hooks/useTemplateDraftGuard";
import { ModulePanelSuspenseFallback } from "@mms/fe-core/components/ModulePanelSuspenseFallback";

const FinanceSettings = lazy(() => import("./FinanceSettings"));

const FinanceTemplateEditor = lazy(() => import("./FinanceTemplateEditor"));

export interface FinanceSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const FinanceSetupTier = function FinanceSetupTier({
  onPrefsDirtyChange,
}: FinanceSetupTierProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(FINANCE_MODULE_MANIFEST);
  const templateGuard = useTemplateDraftGuard();

  const subTabs = useModuleSetupSubTabs({
    initialKey: "preferences",
    isDirty: (currentKey: string) => currentKey === "templates" && templateGuard.isDirty(),
    onDiscard: (leavingKey: string) => {
      if (leavingKey === "templates") templateGuard.discard();
    },
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
              {subTabs.sub === "templates" && (
                <FinanceTemplateEditor
                  key={templateGuard.resetNonce}
                  onDirtyChange={templateGuard.markDirty}
                  onClose={() => subTabs.handleSubTabChange("preferences")}
                />
              )}
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default FinanceSetupTier;
