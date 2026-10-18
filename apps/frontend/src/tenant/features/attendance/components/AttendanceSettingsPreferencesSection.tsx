import React from "react";
import type { AttendanceSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { AttendanceTimingRulesSection } from "./AttendanceTimingRulesSection";
import { AttendanceTeachingDaysSection } from "./AttendanceTeachingDaysSection";
import { AttendanceQrRulesSection } from "./AttendanceQrRulesSection";
import { AttendanceAlertsRulesSection } from "./AttendanceAlertsRulesSection";
import { AttendanceAdvancedRulesSection } from "./AttendanceAdvancedRulesSection";

export interface AttendanceSettingsPreferencesSectionProps {
  settingsDraft: AttendanceSettings;
  upd: <K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function AttendanceSettingsPreferencesSection({
  settingsDraft,
  upd,
  isPrefsDirty,
  saving,
  saved,
  onSave,
}: AttendanceSettingsPreferencesSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <AttendanceTeachingDaysSection
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />

      <AttendanceTimingRulesSection
        settingsDraft={settingsDraft}
        upd={upd}
        t={t}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />

      <AttendanceQrRulesSection
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />

      <AttendanceAlertsRulesSection
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />

      <AttendanceAdvancedRulesSection
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />
    </div>
  );
}
