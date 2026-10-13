import React from "react";
import { Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AttendanceSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionCard } from "@/components/app/SectionCard";
import { ToggleRow } from "@/components/app/ToggleRow";
import { Field } from "@/components/app/FormPrimitives";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";

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
  isPrefsDirty,
  saving,
  saved,
  onSave,
}: AttendanceAlertsRulesSectionProps): React.JSX.Element {
  const { t } = useTranslation();

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
              value={(settingsDraft.lowAttendanceThreshold as number | undefined) || ""}
              onChange={(event) => upd("lowAttendanceThreshold", Number(event.target.value))}
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
