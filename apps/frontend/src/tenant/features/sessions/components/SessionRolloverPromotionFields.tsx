import React from "react";
import {
  ELIGIBILITY_REASONS,
  PROMOTION_OUTCOMES,
  type AppTranslationKey,
  type Session,
} from "@mms/shared";
import { Field, FormSelect } from "@/components/app/FormPrimitives";
import { WarningCallout } from "@/components/app/WarningCallout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import type { SessionRolloverForm } from "@/tenant/features/sessions/hooks/useSessionRolloverForm";

const GRADUATE = "__graduate__";

const OUTCOME_LABEL: Record<(typeof PROMOTION_OUTCOMES)[number], AppTranslationKey> = {
  promote: "sessions.rollover.outcome.promote",
  retain: "sessions.rollover.outcome.retain",
  graduate: "sessions.rollover.outcome.graduate",
  leave: "sessions.rollover.outcome.leave",
};

/** Promote step: where each class moves next, then each student's outcome after a preview. */
export function SessionRolloverPromotionFields({
  session,
  form,
  disabled,
  onPreview,
}: {
  session: Session;
  form: SessionRolloverForm;
  disabled: boolean;
  onPreview: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const classNameOf = (id: string | null) =>
    session.classes.find((cls) => cls.id === id)?.name ?? t("sessions.rollover.graduate");
  const problemLabel = (code: string) => {
    const reason = ELIGIBILITY_REASONS.find((known) => known === code);
    return reason ? t(`apply.reasons.${reason}`) : t("sessions.rollover.noTargetClass");
  };
  const flagged = form.preview?.filter((row) => row.problems.length > 0).length ?? 0;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">{t("sessions.rollover.classMap")}</legend>
        {form.classMap.map((row) => (
          <Field
            key={row.sourceClassId}
            id={`rollover-next-${row.sourceClassId}`}
            label={t("sessions.rollover.nextClassFor", { class: classNameOf(row.sourceClassId) })}
          >
            <FormSelect
              id={`rollover-next-${row.sourceClassId}`}
              name={`next-${row.sourceClassId}`}
              value={row.nextClassId ?? GRADUATE}
              disabled={disabled}
              onChange={(value) =>
                form.setNextClass(row.sourceClassId, value === GRADUATE ? null : value)
              }
              options={[
                { value: GRADUATE, label: t("sessions.rollover.graduate") },
                ...session.classes
                  .filter((cls) => cls.id !== row.sourceClassId)
                  .map((cls) => ({ value: cls.id, label: cls.name })),
              ]}
            />
          </Field>
        ))}
      </fieldset>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={disabled}
        onClick={onPreview}
      >
        {t("sessions.rollover.preview")}
      </Button>
      {form.preview ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">
            {t("sessions.rollover.students", { count: form.preview.length })}
          </legend>
          {flagged > 0 ? (
            <WarningCallout
              density="compact"
              description={t("sessions.rollover.problems", { count: flagged })}
            />
          ) : null}
          <ul className="divide-y divide-border rounded-md border border-border">
            {form.preview.map((row) => (
              <li
                key={row.enrollmentId}
                className="flex flex-wrap items-center justify-between gap-2 p-2"
              >
                <div className="min-w-0 text-start">
                  <p className="truncate text-sm font-medium">{row.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {classNameOf(row.fromClassId)} → {classNameOf(row.toClassId)}
                    {row.problems.length > 0
                      ? ` · ${row.problems.map(problemLabel).join(" ")}`
                      : ""}
                  </p>
                </div>
                <div className="w-40">
                  <FormSelect
                    id={`rollover-outcome-${row.enrollmentId}`}
                    name={`outcome-${row.enrollmentId}`}
                    aria-label={t("sessions.rollover.outcomeFor", { student: row.studentName })}
                    value={row.outcome}
                    disabled={disabled}
                    onChange={(value) =>
                      form.setOutcome(
                        row.enrollmentId,
                        PROMOTION_OUTCOMES.find((outcome) => outcome === value) ?? row.outcome,
                      )
                    }
                    options={PROMOTION_OUTCOMES.map((outcome) => ({
                      value: outcome,
                      label: t(OUTCOME_LABEL[outcome]),
                    }))}
                  />
                </div>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
    </div>
  );
}
