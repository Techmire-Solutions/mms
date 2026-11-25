import React, { useEffect } from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { ModuleSetupSaveFooter } from "@mms/fe-core/components/ModuleSetupSaveFooter";
import { ContactsPreferencesSection } from "./ContactsPreferencesSection.js";
import { useContactsSetupPanelState } from "../hooks/useContactsSetupPanelState";
import { ModuleSetupContent } from "@mms/ui/app/ModuleSetupContent";

export interface ContactsSetupPanelProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export function ContactsSetupPanel({
  onPrefsDirtyChange,
}: ContactsSetupPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { saved, prefs, isSaving, isPrefsDirty, updatePreference, handleSave } =
    useContactsSetupPanelState();

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);

  const isDirty = isPrefsDirty;
  const unsavedWarning = isDirty ? t("contacts.setup.unsavedWarning") : undefined;

  return (
    <ModuleSetupContent>
      <ContactsPreferencesSection
        prefs={prefs}
        isPrefsDirty={isPrefsDirty}
        onUpdatePreference={updatePreference}
        saving={isSaving}
        saved={saved}
      />

      <ModuleSetupSaveFooter
        dirty={isDirty}
        saving={isSaving}
        saved={saved}
        unsavedWarning={unsavedWarning}
        saveLabel={isSaving ? t("global.saving") : t("contacts.setup.saveAndApply")}
        savedLabel={t("contacts.form.saved")}
        onSave={handleSave}
        footerClassName="sticky bottom-0 bg-background mt-0 pt-2 pb-2 justify-start border-border flex-wrap gap-3"
        buttonClassName="flex items-center gap-2 px-5 min-h-11 ms-0"
      />
    </ModuleSetupContent>
  );
}

export default ContactsSetupPanel;
