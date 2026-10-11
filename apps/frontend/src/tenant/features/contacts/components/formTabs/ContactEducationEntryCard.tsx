import type React from "react";
import { GraduationCap, Building2, BookOpen, Calendar, Award } from "lucide-react";
import {
  EditableSelect,
  Field,
  FormCardTypeSelect,
  FormCheckboxCard,
  TYPE_SELECT_WIDTH,
} from "@/components/ui/FormPrimitives";
import { LeadingIconInput } from "@/components/ui/LeadingIconInput";
import { FormListFieldCard } from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import type { ContactEducation } from "@mms/shared";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

export interface ContactEducationEntryCardProps {
  edu: ContactEducation;
  idx: number;
  formInstanceId: string;
  localId: string;
  degreeOptions: string[];
  onUpdateDegreeOptions?: (options: string[]) => void;
  defaultDegree?: string;
  showDegree: boolean;
  showInstitution: boolean;
  showFieldOfStudy: boolean;
  showYear: boolean;
  showGrade: boolean;
  isFieldRequired: (category: "education", field: string) => boolean;
  getListItemError: (category: "education", field: string, idx: number) => string | undefined;
  onUpdateEducation: (patch: Partial<ContactEducation> & Record<string, unknown>) => void;
  onRemoveEducation: () => void;
}

export function ContactEducationEntryCard({
  edu,
  idx,
  formInstanceId,
  localId,
  degreeOptions,
  onUpdateDegreeOptions,
  defaultDegree,
  showDegree,
  showInstitution,
  showFieldOfStudy,
  showYear,
  showGrade,
  isFieldRequired,
  getListItemError,
  onUpdateEducation,
  onRemoveEducation,
}: ContactEducationEntryCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const getErr = (field: string) => getListItemError("education", field, idx);
  const institutionError = getErr("institution");
  const fieldOfStudyError = getErr("fieldOfStudy");
  const yearError = getErr("year");
  const gradeError = getErr("grade");

  return (
    <FormListFieldCard
      id={localId}
      index={idx}
      icon={GraduationCap}
      label={undefined}
      typeSelect={
        showDegree ? (
          <FormCardTypeSelect label={t("contacts.fields.educationDegree")}>
            <EditableSelect
              options={degreeOptions}
              value={edu.degree || defaultDegree || degreeOptions[0] || ""}
              onChange={(val) => onUpdateEducation({ degree: val })}
              onUpdateOptions={onUpdateDegreeOptions}
              className={TYPE_SELECT_WIDTH}
              id={`cf-${formInstanceId}-education-degree-${idx}`}
              name={`cf-${formInstanceId}-education-degree-${idx}`}
              placeholder={t("contacts.form.educationLevelPlaceholder")}
            />
          </FormCardTypeSelect>
        ) : undefined
      }
      onRemove={onRemoveEducation}
      removeLabel={t("contacts.form.removeEducation", { index: idx + 1 })}
    >
      <div className="space-y-3">
        {showInstitution ? (
          <Field
            label={t("contacts.fields.educationInstitution")}
            required={isFieldRequired("education", "institution")}
            error={institutionError}
            id={`cf-${formInstanceId}-education-institution-${idx}`}
          >
            <LeadingIconInput
              icon={Building2}
              id={`cf-${formInstanceId}-education-institution-${idx}`}
              name={`cf-${formInstanceId}-education-institution-${idx}`}
              autoCapitalize="words"
              enterKeyHint="next"
              value={edu.institution || ""}
              required={isFieldRequired("education", "institution")}
              onChange={(e) => onUpdateEducation({ institution: e.target.value })}
              placeholder={t("contacts.form.institutionPlaceholder")}
              className={cn(institutionError && FORM_INPUT_ERROR)}
            />
          </Field>
        ) : null}

        {showFieldOfStudy ? (
          <Field
            label={t("contacts.fields.educationFieldOfStudy")}
            required={isFieldRequired("education", "fieldOfStudy")}
            error={fieldOfStudyError}
            id={`cf-${formInstanceId}-education-field-${idx}`}
          >
            <LeadingIconInput
              icon={BookOpen}
              id={`cf-${formInstanceId}-education-field-${idx}`}
              name={`cf-${formInstanceId}-education-field-${idx}`}
              autoCapitalize="words"
              enterKeyHint="next"
              value={edu.fieldOfStudy || ""}
              required={isFieldRequired("education", "fieldOfStudy")}
              onChange={(e) => onUpdateEducation({ fieldOfStudy: e.target.value })}
              placeholder={t("contacts.form.fieldOfStudyPlaceholder")}
              className={cn(fieldOfStudyError && FORM_INPUT_ERROR)}
            />
          </Field>
        ) : null}

        {showYear || showGrade ? (
          <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
            {showYear ? (
              <Field
                label={t("contacts.fields.educationYear")}
                required={!edu.isCurrentlyEnrolled && isFieldRequired("education", "year")}
                error={yearError}
                id={`cf-${formInstanceId}-education-year-${idx}`}
              >
                <LeadingIconInput
                  icon={Calendar}
                  id={`cf-${formInstanceId}-education-year-${idx}`}
                  name={`cf-${formInstanceId}-education-year-${idx}`}
                  inputMode="numeric"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={
                    edu.isCurrentlyEnrolled ? t("contacts.form.currentlyStudying") : edu.year || ""
                  }
                  disabled={Boolean(edu.isCurrentlyEnrolled)}
                  required={!edu.isCurrentlyEnrolled && isFieldRequired("education", "year")}
                  onChange={(e) => onUpdateEducation({ year: e.target.value })}
                  placeholder={t("contacts.form.passingYearPlaceholder")}
                  className={cn(yearError && FORM_INPUT_ERROR)}
                />
              </Field>
            ) : null}

            {showGrade ? (
              <Field
                label={t("contacts.fields.educationGrade")}
                required={isFieldRequired("education", "grade")}
                error={gradeError}
                id={`cf-${formInstanceId}-education-grade-${idx}`}
              >
                <LeadingIconInput
                  icon={Award}
                  id={`cf-${formInstanceId}-education-grade-${idx}`}
                  name={`cf-${formInstanceId}-education-grade-${idx}`}
                  autoCapitalize="characters"
                  enterKeyHint="next"
                  value={edu.grade || ""}
                  required={isFieldRequired("education", "grade")}
                  onChange={(e) => onUpdateEducation({ grade: e.target.value })}
                  placeholder={t("contacts.form.gradePlaceholder")}
                  className={cn(gradeError && FORM_INPUT_ERROR)}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        <FormCheckboxCard
          id={`cf-${formInstanceId}-education-enrolled-${idx}`}
          name={`cf-${formInstanceId}-education-enrolled-${idx}`}
          checked={Boolean(edu.isCurrentlyEnrolled)}
          onCheckedChange={(checked) =>
            onUpdateEducation({
              isCurrentlyEnrolled: checked,
              year: checked ? "" : edu.year,
            })
          }
          label={t("contacts.form.currentlyStudyingHere")}
        />
      </div>
    </FormListFieldCard>
  );
}
