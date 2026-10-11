import React, { lazy, Suspense, useRef } from "react";
import type { AppTranslationKey } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ConfirmAlertDialog } from "@/components/ui/ConfirmAlertDialog";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { ModulePanelSuspenseFallback } from "@/components/ui/ModulePanelSuspenseFallback";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";
import { SetupReadOnlyMessage } from "@/components/ui/SetupReadOnlyMessage";
import { useUsersSetupPanelState } from "@/tenant/features/users/hooks/useUsersSetupPanelState";

const RolesPermissions = lazy(() =>
  import("@/tenant/features/users/components/RolesPermissions").then((m) => ({
    default: m.RolesPermissions,
  })),
);

const UsersSettingsPanel = lazy(() =>
  import("@/tenant/features/users/components/UsersSettingsPanel").then((m) => ({
    default: m.UsersSettingsPanel,
  })),
);

export interface UsersSetupTab {
  id: string;
  label: string;
}

export interface UsersSetupTierProps {
  tabs: UsersSetupTab[];
  activeTab: string;
  canEditSetup: boolean;
  onTabChange: (tab: string) => void;
}

function discardConfirmKey(leavingTab: string): AppTranslationKey {
  if (leavingTab === "permissions") return "users.setup.discardUnsavedPermissionsConfirm";
  return "users.setup.discardUnsavedPreferencesConfirm";
}

export const UsersSetupTier = function UsersSetupTier({
  tabs,
  activeTab,
  canEditSetup,
  onTabChange,
}: UsersSetupTierProps): React.JSX.Element {
  const { t } = useTranslation();
  const panelState = useUsersSetupPanelState();
  const permissionsDirtyRef = useRef(false);
  const discardPermissionsRef = useRef<() => void>(() => {});

  const handlePermissionsDirtyChange = (dirty: boolean) => {
    permissionsDirtyRef.current = dirty;
  };

  const handleRegisterPermissionsDiscard = (discard: () => void) => {
    discardPermissionsRef.current = discard;
  };

  const subTabs = useModuleSetupSubTabs({
    initialKey: activeTab || "permissions",
    isDirty: (currentKey) => {
      if (currentKey === "preferences") return panelState.dirtyRef.current.prefs;
      if (currentKey === "permissions") return permissionsDirtyRef.current;
      return false;
    },
    onDiscard: (leavingKey) => {
      if (leavingKey === "permissions") {
        discardPermissionsRef.current();
        permissionsDirtyRef.current = false;
        return;
      }
      panelState.discardSetupDrafts();
    },
    onChange: onTabChange,
  });

  const showSettingsPanel = subTabs.showPrefs;

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
            <SetupReadOnlyMessage title={t("users.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              {subTabs.sub === "permissions" ? (
                <RolesPermissions
                  onDirtyChange={handlePermissionsDirtyChange}
                  onRegisterDiscard={handleRegisterPermissionsDiscard}
                />
              ) : null}
              {showSettingsPanel ? (
                <UsersSettingsPanel
                  settingsDraft={panelState.settingsDraft}
                  saved={panelState.saved}
                  saving={panelState.saving}
                  isDirty={panelState.isPrefsDirty}
                  upd={panelState.upd}
                  onSave={() => panelState.handleSave()}
                />
              ) : null}
            </Suspense>
          )}

          <ConfirmAlertDialog
            open={subTabs.discardConfirmOpen}
            onOpenChange={(open) => {
              if (!open) subTabs.clearPendingSubTab();
            }}
            title={t("settings.unsavedChanges")}
            description={t(discardConfirmKey(subTabs.sub))}
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

export default UsersSetupTier;
