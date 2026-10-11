import React from "react";
import { ModuleSetupSaveFooter } from "@/components/ui/ModuleSetupSaveFooter";
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

/** Faculty Setup Preferences body — Employee ID sequence (contact link is always required). */
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
