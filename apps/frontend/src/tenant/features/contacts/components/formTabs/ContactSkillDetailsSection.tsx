import type React from "react";
import { Clock, Building2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormCheckboxCard } from "@/components/app/FormPrimitives";
import { LeadingIconInput } from "@/components/app/LeadingIconInput";
import { cn } from "@/lib/utils";
import type { ContactSkill } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";

export interface ContactSkillDetailsSectionProps {
  skill: ContactSkill;
  idx: number;
  formInstanceId: string;
  showYears: boolean;
  showIsCertified: boolean;
  showIssuer: boolean;
  showDescription: boolean;
  isFieldRequired: (group: string, field: string) => boolean;
  yearsError?: string;
  certifiedError?: string;
  issuerError?: string;
  descriptionError?: string;
  updateSkill: (idx: number, patch: Partial<ContactSkill> & Record<string, unknown>) => void;
  t: TranslationFunction;
}

export function ContactSkillDetailsSection({
  skill,
  idx,
  formInstanceId,
  showYears,
  showIsCertified,
  showIssuer,
  showDescription,
  isFieldRequired,
  yearsError,
  certifiedError,
  issuerError,
  descriptionError,
  updateSkill,
  t,
}: ContactSkillDetailsSectionProps): React.JSX.Element {
  return (
    <>
      {/* Row 2: Experience (Years) & Issued By / Sanad Source */}
      <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
        {showYears ? (
          <Field
            label={t("contacts.fields.skillYears")}
            required={isFieldRequired("skills", "yearsOfExperience")}
            error={yearsError}
            id={`cf-${formInstanceId}-skill-years-${idx}`}
          >
            <LeadingIconInput
              icon={Clock}
              id={`cf-${formInstanceId}-skill-years-${idx}`}
              name={`cf-${formInstanceId}-skill-years-${idx}`}
              inputMode="numeric"
              spellCheck={false}
              enterKeyHint="next"
              value={skill.yearsOfExperience || ""}
              required={isFieldRequired("skills", "yearsOfExperience")}
              onChange={(e) => updateSkill(idx, { yearsOfExperience: e.target.value })}
              placeholder={t("contacts.form.skillYearsPlaceholder")}
              className={cn(yearsError && FORM_INPUT_ERROR)}
            />
          </Field>
        ) : null}

        {showIssuer ? (
          <Field
            label={t("contacts.fields.skillIssuer")}
            required={isFieldRequired("skills", "issuer")}
            error={issuerError}
            id={`cf-${formInstanceId}-skill-issuer-${idx}`}
          >
            <LeadingIconInput
              icon={Building2}
              id={`cf-${formInstanceId}-skill-issuer-${idx}`}
              name={`cf-${formInstanceId}-skill-issuer-${idx}`}
              autoCapitalize="words"
              enterKeyHint="next"
              value={skill.issuer || ""}
              required={isFieldRequired("skills", "issuer")}
              onChange={(e) => updateSkill(idx, { issuer: e.target.value })}
              placeholder={t("contacts.form.skillIssuerPlaceholder")}
              className={cn(issuerError && FORM_INPUT_ERROR)}
            />
          </Field>
        ) : null}
      </div>

      {/* Inline Checkbox: Certified / Ijazah Holder */}
      {showIsCertified ? (
        <FormCheckboxCard
          id={`cf-${formInstanceId}-skill-certified-${idx}`}
          name={`cf-${formInstanceId}-skill-certified-${idx}`}
          checked={Boolean(skill.isCertified)}
          onCheckedChange={(checked) =>
            updateSkill(idx, {
              isCertified: checked,
            })
          }
          label={t("contacts.fields.skillIsCertified")}
          error={certifiedError}
        />
      ) : null}

      {/* Row 4: Notes / Specialization */}
      {showDescription ? (
        <Field
          label={t("contacts.fields.skillDescription")}
          required={isFieldRequired("skills", "description")}
          error={descriptionError}
          id={`cf-${formInstanceId}-skill-desc-${idx}`}
        >
          <Textarea
            id={`cf-${formInstanceId}-skill-desc-${idx}`}
            name={`cf-${formInstanceId}-skill-desc-${idx}`}
            rows={2}
            value={skill.description || ""}
            required={isFieldRequired("skills", "description")}
            onChange={(e) => updateSkill(idx, { description: e.target.value })}
            placeholder={t("contacts.form.skillDescriptionPlaceholder")}
            className={cn("text-xs resize-y min-h-16", descriptionError && FORM_INPUT_ERROR)}
          />
        </Field>
      ) : null}
    </>
  );
}
