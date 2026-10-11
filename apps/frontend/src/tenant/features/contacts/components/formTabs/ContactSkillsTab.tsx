import React, { useCallback } from "react";
import { Award } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ContactSubListShell, resolveSubListAllowAdd } from "./ContactSubListCards";
import type { ContactSubListTabBaseProps } from "./types";
import { useTranslation } from "@/hooks/useTranslation";
import type { ContactSkill } from "@mms/shared";
import { ContactSkillCardItem } from "./ContactSkillCardItem";

/**
 * TypeScript type representing an individual skill/qualification entry.
 */
export type SkillEntry = ContactSkill;

export interface ContactSkillsTabProps extends ContactSubListTabBaseProps {
  categoryOptions: string[];
  onUpdateCategoryOptions?: (options: string[]) => void;
  defaultCategory?: string;
  proficiencyOptions: string[];
  onUpdateProficiencyOptions?: (options: string[]) => void;
  defaultProficiency?: string;
}

export function ContactSkillsTab({
  contactDraft,
  getLocalId,
  categoryOptions,
  onUpdateCategoryOptions,
  defaultCategory,
  proficiencyOptions,
  onUpdateProficiencyOptions,
  defaultProficiency,
  formInstanceId,
  getListItemError,
  isFieldEnabled,
  isFieldRequired,
  addSubListItem,
  ensureSubListItem,
  updateSubListItem,
  removeSubListItem,
}: ContactSkillsTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const showName = isFieldEnabled("skills", "name");
  const showCategory = isFieldEnabled("skills", "category");
  const showProficiency = isFieldEnabled("skills", "proficiency");
  const showYears = isFieldEnabled("skills", "yearsOfExperience");
  const showIsCertified = isFieldEnabled("skills", "isCertified");
  const showIssuer = isFieldEnabled("skills", "issuer");
  const showDescription = isFieldEnabled("skills", "description");

  const allowAdd = resolveSubListAllowAdd([
    showName,
    showCategory,
    showProficiency,
    showYears,
    showIsCertified,
    showIssuer,
    showDescription,
  ]);

  const skills = contactDraft.skills || [];

  const emptySkill = useCallback(
    (): ContactSkill => ({
      name: "",
      category: defaultCategory || categoryOptions[0] || "",
      proficiency: defaultProficiency || (proficiencyOptions ? proficiencyOptions[0] : "") || "",
      yearsOfExperience: "",
      isCertified: false,
      issuer: "",
      description: "",
    }),
    [categoryOptions, defaultCategory, defaultProficiency, proficiencyOptions],
  );

  const addSkill = useCallback(() => {
    addSubListItem("skills", emptySkill());
  }, [addSubListItem, emptySkill]);

  const ensureSkill = useCallback(() => {
    ensureSubListItem("skills", emptySkill());
  }, [ensureSubListItem, emptySkill]);

  const removeSkill = useCallback(
    (idx: number) => {
      removeSubListItem("skills", idx);
    },
    [removeSubListItem],
  );

  const updateSkill = useCallback(
    (idx: number, patch: Partial<ContactSkill> & Record<string, unknown>) => {
      updateSubListItem("skills", idx, patch);
    },
    [updateSubListItem],
  );

  return (
    <ContactSubListShell
      isEmpty={skills.length === 0}
      emptyIcon={Award}
      emptyMessage={t("contacts.form.noSkillsYet")}
      addLabel={t("contacts.form.addSkill")}
      onAdd={addSkill}
      onEnsureRow={ensureSkill}
      allowAdd={allowAdd}
    >
      <AnimatePresence initial={false}>
        {skills.map((skill, idx) => (
          <ContactSkillCardItem
            key={getLocalId("skills", idx)}
            skill={skill}
            idx={idx}
            formInstanceId={formInstanceId}
            categoryOptions={categoryOptions}
            onUpdateCategoryOptions={onUpdateCategoryOptions}
            proficiencyOptions={proficiencyOptions}
            onUpdateProficiencyOptions={onUpdateProficiencyOptions}
            showName={showName}
            showCategory={showCategory}
            showProficiency={showProficiency}
            showYears={showYears}
            showIsCertified={showIsCertified}
            showIssuer={showIssuer}
            showDescription={showDescription}
            isFieldRequired={isFieldRequired}
            getListItemError={getListItemError}
            getLocalId={getLocalId}
            updateSkill={updateSkill}
            removeSkill={removeSkill}
          />
        ))}
      </AnimatePresence>
    </ContactSubListShell>
  );
}
