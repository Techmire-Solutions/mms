import React from "react";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";
import { ToggleRow } from "@shared/ui";
import { Field } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import type { ExaminationsSettings } from "@mms/shared";

export interface ExaminationsPreferencesSectionProps {
  settingsDraft: ExaminationsSettings;
  upd: <K extends keyof ExaminationsSettings>(field: K, value: ExaminationsSettings[K]) => void;
}

export function ExaminationsPreferencesSection({
  settingsDraft,
  upd,
}: ExaminationsPreferencesSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-start">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="exams-grading-system" label={t("examinations.settings.gradingSystem")}>
          <FormSelect
            id="exams-grading-system"
            name="gradingSystem"
            value={settingsDraft.gradingSystem}
            onChange={(value) => upd("gradingSystem", value)}
            options={[
              {
                value: "percentage",
                label: t("examinations.settings.grading.percentage"),
              },
              {
                value: "letter",
                label: t("examinations.settings.grading.letter"),
              },
              {
                value: "gpa",
                label: t("examinations.settings.grading.gpa"),
              },
            ]}
          />
        </Field>

        <Field id="exams-cert-template" label={t("examinations.settings.certificateTemplate")}>
          <FormSelect
            id="exams-cert-template"
            name="certificateTemplate"
            value={settingsDraft.certificateTemplate}
            onChange={(value) => upd("certificateTemplate", value)}
            options={[
              {
                value: "default",
                label: t("examinations.settings.cert.default"),
              },
              {
                value: "modern",
                label: t("examinations.settings.cert.modern"),
              },
              {
                value: "minimal",
                label: t("examinations.settings.cert.minimal"),
              },
            ]}
          />
        </Field>

        <Field id="exams-pass-mark" label={t("examinations.settings.passMark")}>
          <Input
            id="exams-pass-mark"
            name="passMark"
            type="text"
            inputMode="numeric"
            min="0"
            className={FORM_INPUT}
            value={settingsDraft.passMark || ""}
            onChange={(event) => upd("passMark", event.target.value)}
          />
        </Field>

        <Field id="exams-max-mark" label={t("examinations.settings.maxMark")}>
          <Input
            id="exams-max-mark"
            name="maxMark"
            type="text"
            inputMode="numeric"
            min="0"
            className={FORM_INPUT}
            value={settingsDraft.maxMark || ""}
            onChange={(event) => upd("maxMark", event.target.value)}
          />
        </Field>
      </div>

      <div
        className="space-y-2 pt-2 border-t border-border/60"
        role="group"
        aria-label={t("examinations.settings.featureFlags")}
      >
        <ToggleRow
          label={t("examinations.settings.showRankings")}
          description={t("examinations.settings.showRankingsHint")}
          value={settingsDraft.showRankings}
          onChange={(value) => upd("showRankings", value)}
        />
        <ToggleRow
          label={t("examinations.settings.allowRetake")}
          description={t("examinations.settings.allowRetakeHint")}
          value={settingsDraft.allowRetake}
          onChange={(value) => upd("allowRetake", value)}
        />
        <ToggleRow
          label={t("examinations.settings.autoPublishResults")}
          description={t("examinations.settings.autoPublishResultsHint")}
          value={settingsDraft.autoPublishResults}
          onChange={(value) => upd("autoPublishResults", value)}
        />
        <ToggleRow
          label={t("examinations.settings.notifyOnResult")}
          description={t("examinations.settings.notifyOnResultHint")}
          value={settingsDraft.notifyOnResult}
          onChange={(value) => upd("notifyOnResult", value)}
        />
        <ToggleRow
          label={t("examinations.settings.aiGrading")}
          description={t("examinations.settings.aiGradingHint")}
          value={settingsDraft.aiGrading}
          onChange={(value) => upd("aiGrading", value)}
        />
        <ToggleRow
          label={t("examinations.settings.distinguishHonours")}
          description={t("examinations.settings.distinguishHonoursHint")}
          value={settingsDraft.distinguishHonours}
          onChange={(value) => upd("distinguishHonours", value)}
        />
        <ToggleRow
          label={t("examinations.settings.examReminders")}
          description={t("examinations.settings.examRemindersHint")}
          value={settingsDraft.examReminders}
          onChange={(value) => upd("examReminders", value)}
        />
      </div>
    </div>
  );
}
