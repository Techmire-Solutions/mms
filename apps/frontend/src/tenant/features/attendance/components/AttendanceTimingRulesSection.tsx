import React from "react";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AttendanceSettings } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { SectionCard } from "@/components/app/SectionCard";
import { ToggleRow } from "@shared/ui";
import { Field } from "@/components/app/FormPrimitives";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useClampedNumberField } from "@/tenant/features/attendance/hooks/useClampedNumberField";

export interface AttendanceTimingRulesSectionProps {
  settingsDraft: AttendanceSettings;
  upd: <K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) => void;
  t: TranslationFunction;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function AttendanceTimingRulesSection({
  settingsDraft,
  upd,
  t,
}: AttendanceTimingRulesSectionProps): React.JSX.Element {
  const lateThreshold = useClampedNumberField({
    value: settingsDraft.lateThresholdMins,
    min: 0,
    max: Math.max(0, settingsDraft.autoAbsentAfterMins),
    onChange: (value) => upd("lateThresholdMins", value),
  });
  const autoAbsent = useClampedNumberField({
    value: settingsDraft.autoAbsentAfterMins,
    min: 0,
    max: 240,
    onChange: (value) => {
      upd("autoAbsentAfterMins", value);
      if (settingsDraft.lateThresholdMins > value) upd("lateThresholdMins", value);
    },
  });

  return (
    <SectionCard
      accentColor="primary"
      icon={Clock}
      title={t("attendance.settings.timingRules")}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <div className="space-y-4">
        <Field
          id="setting-cutoff-time"
          label={t("attendance.settings.cutoffTime")}
          hint={t("attendance.settings.cutoffTimeDesc")}
        >
          <div className="flex items-center gap-2">
            <Input
              id="setting-cutoff-time"
              name="cutoffTime"
              type="time"
              value={settingsDraft.cutoffTime || ""}
              onChange={(event) => upd("cutoffTime", event.target.value)}
              className={cn(FORM_INPUT, "w-32 text-center")}
            />
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            id="setting-late-threshold"
            label={t("attendance.settings.lateThreshold")}
            hint={t("attendance.settings.lateThresholdDesc")}
          >
            <div className="flex items-center gap-2">
              <Input
                id="setting-late-threshold"
                name="lateThresholdMins"
                type="number"
                inputMode="numeric"
                min={0}
                max={240}
                value={lateThreshold.text}
                onFocus={lateThreshold.onFocus}
                onBlur={lateThreshold.onBlur}
                onChange={(event) => lateThreshold.setText(event.target.value)}
                className={cn(FORM_INPUT, "w-24 text-center")}
              />
              <span className="text-xs text-muted-foreground">
                {t("attendance.settings.minutesShort")}
              </span>
            </div>
          </Field>

          <Field
            id="setting-auto-absent"
            label={t("attendance.settings.autoAbsent")}
            hint={t("attendance.settings.autoAbsentDesc")}
          >
            <div className="flex items-center gap-2">
              <Input
                id="setting-auto-absent"
                name="autoAbsentAfterMins"
                type="number"
                inputMode="numeric"
                min={0}
                max={240}
                value={autoAbsent.text}
                onFocus={autoAbsent.onFocus}
                onBlur={autoAbsent.onBlur}
                onChange={(event) => autoAbsent.setText(event.target.value)}
                className={cn(FORM_INPUT, "w-24 text-center")}
              />
              <span className="text-xs text-muted-foreground">
                {t("attendance.settings.minutesShort")}
              </span>
            </div>
          </Field>
        </div>

        <div className="pt-1 border-t border-border/60 space-y-3">
          <ToggleRow
            label={t("attendance.settings.lockAfterSubmit")}
            description={t("attendance.settings.lockAfterSubmitDesc")}
            value={Boolean(settingsDraft.lockAfterSubmit)}
            onChange={(value) => upd("lockAfterSubmit", value)}
          />
          {/* Both rules are enforced server-side; the toggles that drive them must be reachable. */}
          <ToggleRow
            label={t("attendance.settings.allowManualOverride")}
            description={t("attendance.settings.allowManualOverrideDesc")}
            value={Boolean(settingsDraft.allowManualOverride)}
            onChange={(value) => upd("allowManualOverride", value)}
          />
        </div>
      </div>
    </SectionCard>
  );
}
