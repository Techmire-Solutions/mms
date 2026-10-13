import React from "react";
import { DatePicker } from "@/components/app/DatePicker";
import { Field, FormCheckboxCard } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { ContactExperience } from "@mms/shared";

export interface ContactExperienceDatesSectionProps {
  exp: ContactExperience;
  idx: number;
  formInstanceId: string;
  showStartDate: boolean;
  showEndDate: boolean;
  showIsCurrent: boolean;
  startDateError?: string;
  endDateError?: string;
  isCurrentError?: string;
  isFieldRequired: (category: string, field: string) => boolean;
  onUpdate: (patch: Partial<ContactExperience> & Record<string, unknown>) => void;
}

export function ContactExperienceDatesSection({
  exp,
  idx,
  formInstanceId,
  showStartDate,
  showEndDate,
  showIsCurrent,
  startDateError,
  endDateError,
  isCurrentError,
  isFieldRequired,
  onUpdate,
}: ContactExperienceDatesSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!showStartDate && !showEndDate && !showIsCurrent) return null;

  return (
    <>
      {(showStartDate || showEndDate) && (
        <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
          {showStartDate ? (
            <Field
              label={t("contacts.fields.experienceStartDate")}
              required={isFieldRequired("experience", "startDate")}
              error={startDateError}
              id={`cf-${formInstanceId}-experience-start-${idx}`}
            >
              <DatePicker
                id={`cf-${formInstanceId}-experience-start-${idx}`}
                name={`cf-${formInstanceId}-experience-start-${idx}`}
                value={exp.startDate || undefined}
                required={isFieldRequired("experience", "startDate")}
                onChange={(dateStr) => onUpdate({ startDate: dateStr })}
                placeholder={t("contacts.form.startDatePlaceholder")}
                max={exp.endDate || undefined}
                className={cn(
                  startDateError &&
                    "border-destructive focus-within:border-destructive focus-within:ring-destructive",
                )}
              />
            </Field>
          ) : null}

          {showEndDate ? (
            <Field
              label={t("contacts.fields.experienceEndDate")}
              required={!exp.isCurrent && isFieldRequired("experience", "endDate")}
              error={endDateError}
              id={`cf-${formInstanceId}-experience-end-${idx}`}
            >
              <DatePicker
                id={`cf-${formInstanceId}-experience-end-${idx}`}
                name={`cf-${formInstanceId}-experience-end-${idx}`}
                value={exp.isCurrent ? undefined : exp.endDate || undefined}
                disabled={Boolean(exp.isCurrent)}
                required={!exp.isCurrent && isFieldRequired("experience", "endDate")}
                onChange={(dateStr) => onUpdate({ endDate: dateStr })}
                placeholder={
                  exp.isCurrent ? t("contacts.form.present") : t("contacts.form.endDatePlaceholder")
                }
                min={exp.startDate || undefined}
                className={cn(
                  endDateError &&
                    "border-destructive focus-within:border-destructive focus-within:ring-destructive",
                )}
              />
            </Field>
          ) : null}
        </div>
      )}

      {showIsCurrent ? (
        <FormCheckboxCard
          id={`cf-${formInstanceId}-experience-current-${idx}`}
          name={`cf-${formInstanceId}-experience-current-${idx}`}
          checked={Boolean(exp.isCurrent)}
          onCheckedChange={(checked) =>
            onUpdate({
              isCurrent: checked,
              endDate: checked ? "" : exp.endDate,
            })
          }
          label={t("contacts.form.currentlyWorkingHere")}
          error={isCurrentError}
        />
      ) : null}
    </>
  );
}
