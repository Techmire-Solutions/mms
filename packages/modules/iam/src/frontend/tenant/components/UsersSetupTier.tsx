import React, { lazy, Suspense, useRef } from "react";
import type { AppTranslationKey } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { ConfirmAlertDialog } from "@mms/fe-core/components/ConfirmAlertDialog";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { ModulePanelSuspenseFallback } from "@mms/fe-core/components/ModulePanelSuspenseFallback";
import { SubTabBar } from "@mms/ui/app/SubTabBar";
import { useModuleSetupSubTabs } from "@mms/fe-core/hooks/useModuleSetupSubTabs";
import { SetupReadOnlyMessage } from "@mms/ui/app/SetupReadOnlyMessage";
import { useUsersSetupPanelState } from "../hooks/useUsersSetupPanelState";

const RolesPermissions = lazy(() =>
  import("./RolesPermissions").then((m) => ({
    default: m.RolesPermissions,
  })),
);

const UsersSettingsPanel = lazy(() =>
  import("./UsersSettingsPanel").then((m) => ({
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
