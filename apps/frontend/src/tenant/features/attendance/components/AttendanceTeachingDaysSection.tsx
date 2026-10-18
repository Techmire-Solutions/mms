import React from "react";
import { CalendarDays } from "lucide-react";
import type { AttendanceSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionCard } from "@/components/ui/SectionCard";
import { ToggleRow } from "@/components/ui/ToggleRow";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { ModuleSetupSaveFooter } from "@/components/ui/ModuleSetupSaveFooter";
import { WorkingDaysPicker } from "@/components/common/WorkingDaysPicker";

export interface AttendanceTeachingDaysSectionProps {
  settingsDraft: AttendanceSettings;
  upd: <K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

/** Workspace teaching days + holiday marking policy (drive the instructional-day guard and rates). */
export function AttendanceTeachingDaysSection({
  settingsDraft, upd, isPrefsDirty, saving, saved, onSave,
}: AttendanceTeachingDaysSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard accentColor="primary" icon={CalendarDays} title={t("attendance.settings.teachingDays")} className={SETUP_SECTION_CARD_CLASS}>
      <div className="space-y-4">
        <WorkingDaysPicker
          label={t("attendance.settings.workingDays")}
          description={t("attendance.settings.workingDaysDesc")}
          value={settingsDraft.workingDays}
          onChange={(days) => upd("workingDays", days)}
        />
        <ToggleRow
          label={t("attendance.settings.allowExtraClassOnHolidays")}
          description={t("attendance.settings.allowExtraClassOnHolidaysDesc")}
          value={Boolean(settingsDraft.allowExtraClassOnHolidays)}
          onChange={(value) => upd("allowExtraClassOnHolidays", value)}
        />
      </div>
      <ModuleSetupSaveFooter
        dirty={Boolean(isPrefsDirty)}
        saving={Boolean(saving)}
        saved={Boolean(saved)}
        saveLabel={saving ? t("global.saving") : t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={onSave ?? (() => {})}
        disableUnsavedGuard
        footerClassName="mt-4 pt-3"
      />
    </SectionCard>
  );
}
