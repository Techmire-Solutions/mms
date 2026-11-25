import React from "react";
import { Bell } from "lucide-react";
import { Input } from "@mms/ui";
import { useClampedNumberField } from "@/tenant/features/attendance/hooks/useClampedNumberField";
import { cn } from "@mms/ui";
import type { AttendanceSettings } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { SectionCard } from "@mms/ui";
import { ToggleRow } from "@mms/ui";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@mms/ui";

export interface AttendanceAlertsRulesSectionProps {
  settingsDraft: AttendanceSettings;
  upd: <K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function AttendanceAlertsRulesSection({
  settingsDraft,
  upd,
}: AttendanceAlertsRulesSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const threshold = useClampedNumberField({
    value: settingsDraft.lowAttendanceThreshold,
    min: 1,
    max: 100,
    onChange: (value) => upd("lowAttendanceThreshold", value),
  });

  return (
    <SectionCard
      accentColor="warning"
      icon={Bell}
      title={t("attendance.settings.alerts")}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <div className="space-y-4">
        <Field
          id="setting-low-attendance"
          label={t("attendance.settings.lowThreshold")}
          hint={t("attendance.settings.lowThresholdDesc")}
        >
          <div className="flex items-center gap-2">
            <Input
              id="setting-low-attendance"
              name="lowAttendanceThreshold"
              type="text"
              inputMode="numeric"
              min={50}
              max={100}
              value={threshold.text}
              onFocus={threshold.onFocus}
              onBlur={threshold.onBlur}
              onChange={(event) => threshold.setText(event.target.value)}
              className={cn(FORM_INPUT, "w-24 text-center")}
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </Field>

        <div className="space-y-2 pt-1 border-t border-border/60">
          <ToggleRow
            label={t("attendance.settings.notifyParents")}
            description={t("attendance.settings.notifyParentsDesc")}
            value={Boolean(settingsDraft.notifyParents)}
            onChange={(value) => upd("notifyParents", value)}
          />
          <ToggleRow
            label={t("attendance.settings.requireAbsentNote")}
            description={t("attendance.settings.requireAbsentNoteDesc")}
            value={Boolean(settingsDraft.requireNoteForAbsent)}
            onChange={(value) => upd("requireNoteForAbsent", value)}
          />
        </div>
      </div>
    </SectionCard>
  );
}
