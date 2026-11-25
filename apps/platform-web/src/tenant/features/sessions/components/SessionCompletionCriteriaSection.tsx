import type React from "react";
import { Award } from "lucide-react";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { FormCheckboxCard } from "@mms/ui";
import { SectionCard } from "@mms/ui";
import { FORM_INPUT } from "@mms/ui";
import { Input } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import type { SessionFormDraft } from "@/tenant/features/sessions/lib/sessionFormShared";

/** Completion criteria (short courses): minimum attendance and a required exam pass. */
export function SessionCompletionCriteriaSection({
  sessionDraft,
  errors,
  onDraftChange,
}: {
  sessionDraft: SessionFormDraft;
  errors: Record<string, string>;
  onDraftChange: (patch: Partial<SessionFormDraft>) => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      accentColor="primary"
      icon={Award}
      title={t("sessions.completion.criteriaTitle")}
      className="shadow-sm text-start"
    >
      <Field
        label={t("sessions.completion.minAttendance")}
        id="session-minAttendancePct"
        hint={t("sessions.completion.minAttendanceHint")}
        error={errors.minAttendancePct}
      >
        <Input
          id="session-minAttendancePct"
          name="minAttendancePct"
          inputMode="numeric"
          placeholder="—"
          className={FORM_INPUT}
          value={sessionDraft.minAttendancePct ?? ""}
          onChange={(event) =>
            onDraftChange({
              minAttendancePct: event.target.value.replace(/[^0-9]/g, "").slice(0, 3),
            })
          }
        />
      </Field>
      <FormCheckboxCard
        id="session-requiresExamPass"
        name="requiresExamPass"
        label={t("sessions.completion.requiresExamPass")}
        checked={sessionDraft.requiresExamPass ?? false}
        onCheckedChange={(checked) => onDraftChange({ requiresExamPass: checked })}
      />
    </SectionCard>
  );
}
