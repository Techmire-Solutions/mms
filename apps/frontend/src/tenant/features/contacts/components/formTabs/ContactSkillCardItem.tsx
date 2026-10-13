import type React from "react";
import { Tag } from "lucide-react";
import {
  EditableSelect,
  Field,
  FormCardTypeSelect,
  TYPE_SELECT_WIDTH,
} from "@/components/app/FormPrimitives";
import { LeadingIconInput } from "@/components/app/LeadingIconInput";
import { FormListFieldCard } from "@/components/app/FormPrimitives";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { ContactSkill } from "@mms/shared";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { ContactSkillDetailsSection } from "./ContactSkillDetailsSection";

export interface ContactSkillCardItemProps {
  skill: ContactSkill;
  idx: number;
  formInstanceId: string;
  categoryOptions: string[];
  onUpdateCategoryOptions?: (options: string[]) => void;
  proficiencyOptions: string[];
  onUpdateProficiencyOptions?: (options: string[]) => void;
  showName: boolean;
  showCategory: boolean;
  showProficiency: boolean;
  showYears: boolean;
  showIsCertified: boolean;
  showIssuer: boolean;
  showDescription: boolean;
  isFieldRequired: (group: string, field: string) => boolean;
  getListItemError: (group: string, field: string, index: number) => string | undefined;
  getLocalId: (group: string, index: number) => string;
  updateSkill: (idx: number, patch: Partial<ContactSkill> & Record<string, unknown>) => void;
  removeSkill: (idx: number) => void;
}

export function ContactSkillCardItem({
  skill,
  idx,
  formInstanceId,
  categoryOptions,
  onUpdateCategoryOptions,
  proficiencyOptions,
  onUpdateProficiencyOptions,
  showName,
  showCategory,
  showProficiency,
  showYears,
  showIsCertified,
  showIssuer,
  showDescription,
  isFieldRequired,
  getListItemError,
  getLocalId,
  updateSkill,
  removeSkill,
}: ContactSkillCardItemProps): React.JSX.Element {
  const { t } = useTranslation();

  const nameError = getListItemError("skills", "name", idx);
  const proficiencyError = getListItemError("skills", "proficiency", idx);
  const yearsError = getListItemError("skills", "yearsOfExperience", idx);
  const certifiedError = getListItemError("skills", "isCertified", idx);
  const issuerError = getListItemError("skills", "issuer", idx);
  const descriptionError = getListItemError("skills", "description", idx);

  return (
    <FormListFieldCard
      key={getLocalId("skills", idx)}
      id={getLocalId("skills", idx)}
      index={idx}
      icon={Tag}
      label={undefined}
      typeSelect={
        showCategory ? (
          <FormCardTypeSelect label={t("contacts.fields.skillCategory")}>
            <EditableSelect
              options={categoryOptions}
              value={skill.category || ""}
              onChange={(val) => updateSkill(idx, { category: val })}
              onUpdateOptions={onUpdateCategoryOptions}
              className={TYPE_SELECT_WIDTH}
              id={`cf-${formInstanceId}-skill-category-${idx}`}
              name={`cf-${formInstanceId}-skill-category-${idx}`}
              placeholder={t("contacts.form.skillCategoryPlaceholder")}
            />
          </FormCardTypeSelect>
        ) : undefined
      }
      onRemove={() => removeSkill(idx)}
      removeLabel={t("contacts.form.removeSkill", { index: idx + 1 })}
    >
      <div className="space-y-3">
        {/* Row 1: Skill / Subject Name & Proficiency Level */}
        <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
          {showName ? (
            <Field
              label={t("contacts.fields.skillName")}
              required={isFieldRequired("skills", "name")}
              error={nameError}
              id={`cf-${formInstanceId}-skill-name-${idx}`}
            >
              <LeadingIconInput
                icon={Tag}
                id={`cf-${formInstanceId}-skill-name-${idx}`}
                name={`cf-${formInstanceId}-skill-name-${idx}`}
                autoCapitalize="words"
                enterKeyHint="next"
                value={skill.name || ""}
                required={isFieldRequired("skills", "name")}
                onChange={(e) => updateSkill(idx, { name: e.target.value })}
                placeholder={t("contacts.form.skillNamePlaceholder")}
                className={cn(nameError && FORM_INPUT_ERROR)}
              />
            </Field>
          ) : null}

          {showProficiency ? (
            <Field
              label={t("contacts.fields.skillProficiency")}
              required={isFieldRequired("skills", "proficiency")}
              error={proficiencyError}
              id={`cf-${formInstanceId}-skill-proficiency-${idx}`}
            >
              <EditableSelect
                options={proficiencyOptions}
                value={skill.proficiency || ""}
                onChange={(val) => updateSkill(idx, { proficiency: val })}
                onUpdateOptions={onUpdateProficiencyOptions}
                className="w-full"
                id={`cf-${formInstanceId}-skill-proficiency-${idx}`}
                name={`cf-${formInstanceId}-skill-proficiency-${idx}`}
                placeholder={t("contacts.form.skillProficiencyPlaceholder")}
              />
            </Field>
          ) : null}
        </div>

        <ContactSkillDetailsSection
          skill={skill}
          idx={idx}
          formInstanceId={formInstanceId}
          showYears={showYears}
          showIsCertified={showIsCertified}
          showIssuer={showIssuer}
          showDescription={showDescription}
          isFieldRequired={isFieldRequired}
          yearsError={yearsError}
          certifiedError={certifiedError}
          issuerError={issuerError}
          descriptionError={descriptionError}
          updateSkill={updateSkill}
          t={t}
        />
      </div>
    </FormListFieldCard>
  );
}

/** Canonical alias aligning with ContactAddressEntryCard, ContactEducationEntryCard, ContactExperienceEntryCard. */
export type ContactSkillEntryCardProps = ContactSkillCardItemProps;
export const ContactSkillEntryCard = ContactSkillCardItem;
