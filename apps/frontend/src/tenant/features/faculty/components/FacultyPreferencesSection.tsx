import React from "react";
import { Contact } from "lucide-react";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { SectionCard } from "@/components/app/SectionCard";
import { FormCheckboxCard } from "@/components/app/FormPrimitives";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import type { FacultySettings } from "@mms/shared";
import { FacultyIdSettingsCard } from "./FacultyIdSettingsCard";

export interface FacultyPreferencesSectionProps {
  settingsDraft: FacultySettings;
  upd: <K extends keyof FacultySettings>(field: K, value: FacultySettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  unsavedWarning?: string;
  onSave?: () => void | Promise<void>;
}

/** Faculty Setup Preferences body — Employee ID sequence + contact eligibility toggles. */
export function FacultyPreferencesSection({
  settingsDraft,
  upd,
  isPrefsDirty,
  saving,
  saved,
  unsavedWarning,
  onSave,
}: FacultyPreferencesSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-start">
      <FacultyIdSettingsCard settingsDraft={settingsDraft} upd={upd} />

      <SectionCard
        title={t("faculty.settings.contactRequirementsTitle")}
        icon={Contact}
        headingLevel={2}
        className={SETUP_SECTION_CARD_CLASS}
      >
        <div className="space-y-2">
          <FormCheckboxCard
            id="faculty-require-contact-phone"
            checked={settingsDraft.requireContactPhone}
            onCheckedChange={(value) => upd("requireContactPhone", value)}
            label={t("faculty.settings.requireContactPhone")}
            description={t("faculty.settings.requireContactPhoneDesc")}
          />
          <FormCheckboxCard
            id="faculty-require-contact-email"
            checked={settingsDraft.requireContactEmail}
            onCheckedChange={(value) => upd("requireContactEmail", value)}
            label={t("faculty.settings.requireContactEmail")}
            description={t("faculty.settings.requireContactEmailDesc")}
          />
        </div>
      </SectionCard>

      <ModuleSetupSaveFooter
        dirty={Boolean(isPrefsDirty)}
        saving={Boolean(saving)}
        saved={Boolean(saved)}
        unsavedWarning={unsavedWarning}
        saveLabel={saving ? t("global.saving") : t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={onSave ?? (() => {})}
        disableUnsavedGuard
        footerClassName="mt-4 pt-3"
      />
    </div>
  );
}
