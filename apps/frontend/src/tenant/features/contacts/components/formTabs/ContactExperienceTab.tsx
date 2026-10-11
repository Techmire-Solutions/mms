import React, { useCallback } from "react";
import { Briefcase } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ContactSubListShell, resolveSubListAllowAdd } from "./ContactSubListCards";
import { ContactExperienceEntryCard } from "./ContactExperienceEntryCard";
import { createEmptyExperience } from "./contactExperienceShared";
import type { ContactSubListTabBaseProps } from "./types";
import { useTranslation } from "@/hooks/useTranslation";
import type { ContactExperience } from "@mms/shared";

/**
 * TypeScript type representing an individual experience entry.
 */
export type ExperienceEntry = ContactExperience;

export interface ContactExperienceTabProps extends ContactSubListTabBaseProps {
  employmentTypeOptions: string[];
  onUpdateEmploymentTypeOptions?: (options: string[]) => void;
  defaultEmploymentType?: string;
}

export function ContactExperienceTab({
  contactDraft,
  getLocalId,
  employmentTypeOptions,
  onUpdateEmploymentTypeOptions,
  defaultEmploymentType,
  formInstanceId,
  getListItemError,
  isFieldEnabled,
  isFieldRequired,
  addSubListItem,
  ensureSubListItem,
  updateSubListItem,
  removeSubListItem,
}: ContactExperienceTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const showTitle = isFieldEnabled("experience", "title");
  const showOrganization = isFieldEnabled("experience", "organization");
  const showEmploymentType = isFieldEnabled("experience", "employmentType");
  const showLocation = isFieldEnabled("experience", "location");
  const showStartDate = isFieldEnabled("experience", "startDate");
  const showEndDate = isFieldEnabled("experience", "endDate");
  const showIsCurrent = isFieldEnabled("experience", "isCurrent");
  const showDescription = isFieldEnabled("experience", "description");

  const allowAdd = resolveSubListAllowAdd([
    showTitle,
    showOrganization,
    showEmploymentType,
    showLocation,
    showStartDate,
    showEndDate,
    showIsCurrent,
    showDescription,
  ]);

  const experiences = contactDraft.experience || [];

  const emptyExperience = useCallback(
    () => createEmptyExperience(defaultEmploymentType, employmentTypeOptions),
    [defaultEmploymentType, employmentTypeOptions],
  );

  const addExperience = useCallback(() => {
    addSubListItem("experience", emptyExperience());
  }, [addSubListItem, emptyExperience]);

  const ensureExperience = useCallback(() => {
    ensureSubListItem("experience", emptyExperience());
  }, [ensureSubListItem, emptyExperience]);

  const removeExperience = useCallback(
    (idx: number) => {
      removeSubListItem("experience", idx);
    },
    [removeSubListItem],
  );

  const updateExperience = useCallback(
    (idx: number, patch: Partial<ContactExperience> & Record<string, unknown>) => {
      updateSubListItem("experience", idx, patch);
    },
    [updateSubListItem],
  );

  return (
    <ContactSubListShell
      isEmpty={experiences.length === 0}
      emptyIcon={Briefcase}
      emptyMessage={t("contacts.form.noExperienceYet")}
      addLabel={t("contacts.form.addExperience")}
      onAdd={addExperience}
      onEnsureRow={ensureExperience}
      allowAdd={allowAdd}
    >
      <AnimatePresence initial={false}>
        {experiences.map((exp, idx) => (
          <ContactExperienceEntryCard
            key={getLocalId("experience", idx)}
            exp={exp}
            idx={idx}
            formInstanceId={formInstanceId}
            getLocalId={getLocalId}
            getListItemError={getListItemError}
            isFieldRequired={isFieldRequired}
            showTitle={showTitle}
            showOrganization={showOrganization}
            showEmploymentType={showEmploymentType}
            showLocation={showLocation}
            showStartDate={showStartDate}
            showEndDate={showEndDate}
            showIsCurrent={showIsCurrent}
            showDescription={showDescription}
            employmentTypeOptions={employmentTypeOptions}
            onUpdateEmploymentTypeOptions={onUpdateEmploymentTypeOptions}
            onUpdate={(patch) => updateExperience(idx, patch)}
            onRemove={() => removeExperience(idx)}
          />
        ))}
      </AnimatePresence>
    </ContactSubListShell>
  );
}
