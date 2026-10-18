import React from "react";
import { formatMonthName, normalizeSessionsViewLayout, type SessionsSettings } from "@mms/shared";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";
import { ToggleRow } from "@/components/app/ToggleRow";
import { Field } from "@/components/app/FormPrimitives";
import { CompactSegmentedControl } from "@/components/app/CompactSegmentedControl";
import { useTranslation } from "@/hooks/useTranslation";

export interface SessionsSettingsPreferencesProps {
  settingsDraft: SessionsSettings;
  typeOptions: string[];
  upd: <K extends keyof SessionsSettings>(field: K, value: SessionsSettings[K]) => void;
}

export function SessionsSettingsPreferences({
  settingsDraft,
  typeOptions,
  upd,
}: SessionsSettingsPreferencesProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-start">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("sessions.settings.defaultDuration")} id="defaultDuration">
          <Input
            id="defaultDuration"
            name="defaultDuration"
            type="text"
            inputMode="numeric"
            min="1"
            className={FORM_INPUT}
            value={settingsDraft.defaultDuration || ""}
            onChange={(event) => upd("defaultDuration", event.target.value)}
          />
        </Field>
        <Field label={t("sessions.settings.defaultSessionType")} id="defaultSessionType">
          <FormSelect
            id="defaultSessionType"
            name="defaultSessionType"
            value={settingsDraft.defaultSessionType}
            onChange={(value) => upd("defaultSessionType", value)}
            options={typeOptions}
            className="w-full"
          />
        </Field>
        <Field label={t("sessions.settings.academicYear")} id="academicYear">
          <Input
            id="academicYear"
            name="academicYear"
            type="text"
            className={FORM_INPUT}
            value={settingsDraft.academicYear || ""}
            onChange={(event) => upd("academicYear", event.target.value)}
            placeholder={t("sessions.settings.academicYearPlaceholder")}
          />
        </Field>
        <Field label={t("sessions.settings.sessionStart")} id="sessionStart">
          <FormSelect
            id="sessionStart"
            name="sessionStart"
            value={settingsDraft.sessionStart}
            onChange={(value) => upd("sessionStart", value)}
            options={[
              "january",
              "february",
              "march",
              "april",
              "may",
              "june",
              "july",
              "august",
              "september",
              "october",
              "november",
              "december",
            ].map((month, idx) => ({
              value: month,
              label: formatMonthName(new Date(2000, idx, 1)),
            }))}
            className="w-full"
          />
        </Field>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/60">
        <ToggleRow
          label={t("sessions.settings.allowOverlap")}
          description={t("sessions.settings.allowOverlapHint")}
          value={settingsDraft.allowOverlap}
          onChange={(value) => upd("allowOverlap", value)}
        />
        <ToggleRow
          label={t("sessions.settings.archiveOld")}
          description={t("sessions.settings.archiveOldHint")}
          value={settingsDraft.archiveOldSessions}
          onChange={(value) => upd("archiveOldSessions", value)}
        />
        <ToggleRow
          label={t("sessions.settings.requireBudget")}
          description={t("sessions.settings.requireBudgetHint")}
          value={settingsDraft.requireBudget}
          onChange={(value) => upd("requireBudget", value)}
        />
        <ToggleRow
          label={t("sessions.settings.timetableConflict")}
          description={t("sessions.settings.timetableConflictHint")}
          value={settingsDraft.timetableConflictCheck}
          onChange={(value) => upd("timetableConflictCheck", value)}
        />
        <ToggleRow
          label={t("sessions.settings.notifyOnStart")}
          description={t("sessions.settings.notifyOnStartHint")}
          value={settingsDraft.notifyOnSessionStart}
          onChange={(value) => upd("notifyOnSessionStart", value)}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-foreground">
              {t("sessions.settings.defaultViewLayout")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("sessions.settings.defaultViewLayoutHint")}
            </p>
          </div>
          <CompactSegmentedControl
            value={normalizeSessionsViewLayout(settingsDraft.defaultViewLayout)}
            onChange={(value) => upd("defaultViewLayout", value)}
            options={[
              { value: "table", label: t("sessions.settings.tableView") },
              { value: "cards", label: t("sessions.settings.cardGrid") },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
