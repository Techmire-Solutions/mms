import React, { useRef, lazy, Suspense } from "react";
import { CONTACTS_MODULE_MANIFEST, DEFAULT_SETTINGS_SUB_TABS } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { SubTabBar } from "@/components/app/SubTabBar";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { SetupReadOnlyMessage } from "@/components/app/SetupReadOnlyMessage";
import { shouldOpenContactsSyncSetup } from "@/lib/contacts/googleContactsOAuth";
import { resolveRegistryLabel } from "@/lib/contacts/contactI18n";
import type { Contact } from "@mms/shared";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";
import { ModulePanelSuspenseFallback } from "@/components/app/ModulePanelSuspenseFallback";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";

const ContactsSetupPanel = lazy(
  () => import("@/tenant/features/contacts/components/ContactsSetupPanel"),
);
const ContactSyncPanel = lazy(
  () => import("@/tenant/features/contacts/components/ContactSyncPanel"),
);

export interface ContactsSetupTierProps {
  onImport: (list: Contact[]) => void | Promise<void>;
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
