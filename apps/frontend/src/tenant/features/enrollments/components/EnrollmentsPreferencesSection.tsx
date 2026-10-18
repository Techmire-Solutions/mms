import React from "react";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { ToggleRow } from "@shared/ui";
import { Field } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import type { EnrollmentsSettings } from "@mms/shared";

export interface EnrollmentsPreferencesSectionProps {
  settingsDraft: EnrollmentsSettings;
  upd: <K extends keyof EnrollmentsSettings>(field: K, value: EnrollmentsSettings[K]) => void;
}

export function EnrollmentsPreferencesSection({
  settingsDraft,
  upd,
}: EnrollmentsPreferencesSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-start">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="maxStudentsPerClass" label={t("enrollments.settings.maxStudentsPerClass")}>
          <Input
            id="maxStudentsPerClass"
            name="maxStudentsPerClass"
            type="text"
            inputMode="numeric"
            className={FORM_INPUT}
            value={settingsDraft.maxStudentsPerClass || ""}
            onChange={(event) => upd("maxStudentsPerClass", event.target.value)}
          />
        </Field>
        <Field id="dropDeadlineDays" label={t("enrollments.settings.dropDeadlineDays")}>
          <Input
            id="dropDeadlineDays"
            name="dropDeadlineDays"
            type="text"
            inputMode="numeric"
            className={FORM_INPUT}
            value={settingsDraft.dropDeadlineDays || ""}
            onChange={(event) => upd("dropDeadlineDays", event.target.value)}
          />
        </Field>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/60">
        <ToggleRow
          label={t("enrollments.settings.waitlistEnabled")}
          description={t("enrollments.settings.waitlistEnabledHint")}
          value={settingsDraft.waitlistEnabled}
          onChange={(value) => upd("waitlistEnabled", value)}
        />
        <ToggleRow
          label={t("enrollments.settings.requireEligibilityCheck")}
          description={t("enrollments.settings.requireEligibilityCheckHint")}
          value={settingsDraft.requireEligibilityCheck}
          onChange={(value) => upd("requireEligibilityCheck", value)}
        />
        <ToggleRow
          label={t("enrollments.settings.autoAssignClass")}
          description={t("enrollments.settings.autoAssignClassHint")}
          value={settingsDraft.autoAssignClass}
          onChange={(value) => upd("autoAssignClass", value)}
        />
        <ToggleRow
          label={t("enrollments.settings.enrollmentApproval")}
          description={t("enrollments.settings.enrollmentApprovalHint")}
          value={settingsDraft.enrollmentApproval}
          onChange={(value) => upd("enrollmentApproval", value)}
        />
        <ToggleRow
          label={t("enrollments.settings.allowTransfers")}
          description={t("enrollments.settings.allowTransfersHint")}
          value={settingsDraft.allowTransfers}
          onChange={(value) => upd("allowTransfers", value)}
        />
        <ToggleRow
          label={t("enrollments.settings.reenrollmentReminder")}
          description={t("enrollments.settings.reenrollmentReminderHint")}
          value={settingsDraft.reenrollmentReminder}
          onChange={(value) => upd("reenrollmentReminder", value)}
        />
      </div>
    </div>
  );
}
