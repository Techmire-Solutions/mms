import React, { lazy, Suspense, useRef } from "react";
import type { Denomination } from "@mms/shared";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/ui/SetupReadOnlyMessage";
import { ConfirmAlertDialog } from "@/components/ui/ConfirmAlertDialog";
import { ModulePanelSuspenseFallback } from "@/components/ui/ModulePanelSuspenseFallback";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";
import { useTranslation } from "@/hooks/useTranslation";

const DenominationsManager = lazy(() =>
  import("@/tenant/features/hasanat/components/DenominationsManager").then((m) => ({
    default: m.DenominationsManager,
  })),
);

const HasanatSettings = lazy(() => import("@/tenant/features/hasanat/components/HasanatSettings"));

const HasanatTemplateEditor = lazy(
  () => import("@/tenant/features/hasanat/components/HasanatTemplateEditor"),
);

export interface SetupTab {
  id: string;
  label: string;
}

export interface HasanatSetupTierProps {
  tabs: SetupTab[];
  activeTab: string;
  canEditSetup: boolean;
  canWrite: boolean;
  denoms: Denomination[];
  onTabChange: (tab: string) => void;
  onUpdateDenoms: (denoms: Denomination[]) => Promise<void>;
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const HasanatSetupTier = function HasanatSetupTier({
  tabs,
  activeTab,
  canEditSetup,
  canWrite,
  denoms,
  onTabChange,
  onUpdateDenoms,
  onPrefsDirtyChange,
}: HasanatSetupTierProps): React.JSX.Element {
  const { t } = useTranslation();
  const prefsDirtyRef = useRef(false);

  const handlePrefsDirtyChange = (dirty: boolean) => {
    prefsDirtyRef.current = dirty;
    onPrefsDirtyChange?.(dirty);
  };

  const subTabs = useModuleSetupSubTabs({
    initialKey: activeTab || "denominations",
    isDirty: (currentKey: string) => {
      if (currentKey === "preferences") return prefsDirtyRef.current;
      return false;
    },
    onDiscard: (leavingKey: string) => {
      if (leavingKey === "preferences") {
        prefsDirtyRef.current = false;
        onPrefsDirtyChange?.(false);
      }
    },
    onChange: onTabChange,
  });

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          <SubTabBar
            tabs={tabs.map((tab) => ({ key: tab.id, label: tab.label }))}
            value={subTabs.sub}
            onChange={subTabs.handleSubTabChange}
          />
          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("hasanat.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              {subTabs.sub === "denominations" && (
                <DenominationsManager
                  denoms={denoms}
                  onUpdate={onUpdateDenoms}
                  canWrite={canWrite}
                />
              )}
              {subTabs.sub === "preferences" && (
                <HasanatSettings onPrefsDirtyChange={handlePrefsDirtyChange} />
              )}
              {subTabs.sub === "templates" && <HasanatTemplateEditor />}
            </Suspense>
          )}

          <ConfirmAlertDialog
            open={subTabs.discardConfirmOpen}
            onOpenChange={(open) => {
              if (!open) subTabs.clearPendingSubTab();
            }}
            title={t("settings.unsavedChanges")}
            description={t("hasanat.setup.unsavedPreferencesWarning")}
            confirmLabel={t("common.yes")}
            cancelLabel={t("common.cancel")}
            destructive
            onConfirm={subTabs.handleConfirmDiscard}
          />
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default HasanatSetupTier;
