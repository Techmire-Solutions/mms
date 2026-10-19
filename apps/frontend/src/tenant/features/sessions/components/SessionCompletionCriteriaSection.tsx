import type React from "react";
import { Award } from "lucide-react";
import { Field } from "@/components/app/FormPrimitives";
import { FormCheckboxCard } from "@/components/app/FormCheckboxCard";
import { SectionCard } from "@/components/app/SectionCard";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
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
