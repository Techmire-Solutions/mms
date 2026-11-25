import React, { useRef, lazy, Suspense } from "react";
import { CONTACTS_MODULE_MANIFEST, DEFAULT_SETTINGS_SUB_TABS } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { SubTabBar } from "@mms/ui/app/SubTabBar";
import { ConfirmAlertDialog } from "@mms/fe-core/components/ConfirmAlertDialog";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { SetupReadOnlyMessage } from "@mms/ui/app/SetupReadOnlyMessage";
import { shouldOpenContactsSyncSetup } from "@mms/mod-contacts/frontend/tenant/lib/googleContactsOAuth";
import { resolveRegistryLabel } from "@mms/fe-core/lib/contactI18n";
import type { Contact } from "@mms/contracts";
import { useModuleSetupSubTabs } from "@mms/fe-core/hooks/useModuleSetupSubTabs";
import { ModulePanelSuspenseFallback } from "@mms/fe-core/components/ModulePanelSuspenseFallback";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";

const ContactsSetupPanel = lazy(() => import("./ContactsSetupPanel.js"));
const ContactSyncPanel = lazy(() => import("./ContactSyncPanel.js"));

export interface ContactsSetupTierProps {
  onImport: (
    list: Contact[],
    options?: { onProgress?: (progress: { imported: number; total: number }) => void },
  ) =>
    | void
    | { succeeded: number; failed: number }
    | Promise<void | { succeeded: number; failed: number }>;
  canWrite: boolean;
  canEditSetup: boolean;
}

export const ContactsSetupTier = function ContactsSetupTier({
  onImport,
  canWrite,
  canEditSetup,
}: ContactsSetupTierProps): React.JSX.Element {
  const { t } = useTranslation();
  const dirtyRef = useRef({ prefs: false });

  const settingsSubTabs = (() => {
    const defaultByKey = new Map(DEFAULT_SETTINGS_SUB_TABS.map((tab) => [tab.key, tab]));
    return CONTACTS_MODULE_MANIFEST.setupSubTabs
      .map((key, index) => {
        const seedTab = defaultByKey.get(key);
        const labelSource = {
          label: seedTab?.label ?? key,
          labelKey: seedTab?.labelKey,
        };
        return {
          key,
          label: resolveRegistryLabel(labelSource, t),
          order: seedTab?.order ?? index,
          enabled: seedTab?.enabled ?? true,
        };
      })
      .filter((tab) => tab.enabled)
      .sort((a, b) => a.order - b.order);
  })();

  const subTabs = useModuleSetupSubTabs({
    initialKey: shouldOpenContactsSyncSetup() ? "sync" : settingsSubTabs[0]?.key || "preferences",
    isDirty: (currentKey) => {
      if (currentKey === "preferences") return dirtyRef.current.prefs;
      return false;
    },
    onDiscard: (leavingKey) => {
      if (leavingKey === "preferences") dirtyRef.current.prefs = false;
    },
  });

  const setPrefsDirty = (isDirty: boolean): void => {
    dirtyRef.current.prefs = isDirty;
  };

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          <SubTabBar
            tabs={settingsSubTabs.map((tab) => ({ key: tab.key, label: tab.label }))}
            value={subTabs.sub}
            onChange={subTabs.handleSubTabChange}
          />
          <Suspense fallback={<ModulePanelSuspenseFallback />}>
            {subTabs.showPrefs &&
              (canEditSetup ? (
                <ContactsSetupPanel onPrefsDirtyChange={setPrefsDirty} />
              ) : (
                <SetupReadOnlyMessage title={t("contacts.setup.readOnly")} />
              ))}
            {subTabs.showSync && (
              // Sync mutates contacts + OAuth secrets — gate on contacts.write (canWrite),
              // never OR with canEditSetup (mms-auth-security). Fields/Prefs stay canEditSetup.
              <ContactSyncPanel onImport={onImport} canWrite={canWrite} />
            )}
          </Suspense>

          <ConfirmAlertDialog
            open={subTabs.discardConfirmOpen}
            onOpenChange={(open) => {
              if (!open) subTabs.clearPendingSubTab();
            }}
            title={t("settings.unsavedChanges")}
            description={t("contacts.setup.discardUnsavedPreferencesConfirm")}
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

export default ContactsSetupTier;
