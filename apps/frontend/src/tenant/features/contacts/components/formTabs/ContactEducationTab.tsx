import React, { useCallback } from "react";
import { GraduationCap } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ContactSubListShell, resolveSubListAllowAdd } from "./ContactSubListCards";
import { ContactEducationEntryCard } from "./ContactEducationEntryCard";
import type { ContactSubListTabBaseProps } from "./types";
import { useTranslation } from "@/hooks/useTranslation";
import type { ContactEducation } from "@mms/shared";

/**
 * TypeScript interface representing an individual education entry.
 */
export type EducationEntry = ContactEducation;

export interface ContactEducationTabProps extends ContactSubListTabBaseProps {
  degreeOptions: string[];
  onUpdateDegreeOptions?: (options: string[]) => void;
  defaultDegree?: string;
}

export function ContactEducationTab({
  contactDraft,
  getLocalId,
  degreeOptions,
  onUpdateDegreeOptions,
  defaultDegree,
  formInstanceId,
  getListItemError,
  isFieldEnabled,
  isFieldRequired,
  addSubListItem,
  ensureSubListItem,
  updateSubListItem,
  removeSubListItem,
}: ContactEducationTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const showDegree = isFieldEnabled("education", "degree");
  const showInstitution = isFieldEnabled("education", "institution");
  const showFieldOfStudy = isFieldEnabled("education", "fieldOfStudy");
  const showYear = isFieldEnabled("education", "year");
  const showGrade = isFieldEnabled("education", "grade");
  const allowAdd = resolveSubListAllowAdd([
    showDegree,
    showInstitution,
    showFieldOfStudy,
    showYear,
    showGrade,
  ]);

  const educations = contactDraft.education || [];

  const emptyEducation = useCallback(
    (): ContactEducation => ({
      degree: defaultDegree || degreeOptions[0] || "",
      institution: "",
      fieldOfStudy: "",
      year: "",
      grade: "",
      isCurrentlyEnrolled: false,
    }),
    [defaultDegree, degreeOptions],
  );

  const addEducation = useCallback(() => {
    addSubListItem("education", emptyEducation());
  }, [addSubListItem, emptyEducation]);

  const ensureEducation = useCallback(() => {
    ensureSubListItem("education", emptyEducation());
  }, [ensureSubListItem, emptyEducation]);

  const removeEducation = useCallback(
    (idx: number) => {
      removeSubListItem("education", idx);
    },
    [removeSubListItem],
  );

  const updateEducation = useCallback(
    (idx: number, patch: Partial<ContactEducation> & Record<string, unknown>) => {
      updateSubListItem("education", idx, patch);
    },
    [updateSubListItem],
  );

  return (
    <ContactSubListShell
      isEmpty={educations.length === 0}
      emptyIcon={GraduationCap}
      emptyMessage={t("contacts.form.noEducationYet")}
      addLabel={t("contacts.form.addEducation")}
      onAdd={addEducation}
      onEnsureRow={ensureEducation}
      allowAdd={allowAdd}
    >
      <AnimatePresence initial={false}>
        {educations.map((edu, idx) => (
          <ContactEducationEntryCard
            key={getLocalId("education", idx)}
            edu={edu}
            idx={idx}
            formInstanceId={formInstanceId}
            localId={getLocalId("education", idx)}
            degreeOptions={degreeOptions}
            onUpdateDegreeOptions={onUpdateDegreeOptions}
            defaultDegree={defaultDegree}
            showDegree={showDegree}
            showInstitution={showInstitution}
            showFieldOfStudy={showFieldOfStudy}
            showYear={showYear}
            showGrade={showGrade}
            isFieldRequired={isFieldRequired}
            getListItemError={getListItemError}
            onUpdateEducation={(patch) => updateEducation(idx, patch)}
            onRemoveEducation={() => removeEducation(idx)}
          />
        ))}
      </AnimatePresence>
    </ContactSubListShell>
  );
}
