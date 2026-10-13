import type { Contact, FieldDefinition, Student } from "@mms/shared";
import {
  StudentContactSection,
  StudentGuardianSection,
  StudentRegistrationSection,
  type StudentFieldErrorGetter,
  type StudentStatusSelectOption,
} from "@/tenant/features/students/components/StudentFormSections";
import { EntityNotesFormSection } from "@/components/app/EntityNotesFormSection";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveStudentFieldLabel } from "@/tenant/features/students/components/StudentFormSectionShared";
import React from "react";

export interface StudentFormTabContentProps {
  formInstanceId: string;
  studentDraft: Partial<Student>;
  linkedContact?: Contact | null;
  linkedGenderRaw?: string;
  linkedGenderLabel: string;
  linkedDob: string;
  excludeIds: string[];
  isGrAutoAssigned: boolean;
  grInputDisabled: boolean;
  autoGenerateId?: boolean;
  isCreate?: boolean;
  nextGrNumber?: string;
  statusSelectOptions: StudentStatusSelectOption[];
  statuses?: string[];
  onUpdateStatuses?: (statuses: string[]) => void | Promise<void>;
  fields: Record<string, FieldDefinition[]>;
  isFieldEnabled: (fieldId: string) => boolean;
  isFieldRequired: (fieldId: string) => boolean;
  getFieldError: StudentFieldErrorGetter;
  onContactSelect: (id: string | number | null) => void;
  onStudentAvatarChange: (avatarUrl: string) => void | Promise<void>;
  onGrNumberChange: (value: string) => void;
  onDraftChange: (patch: Partial<Student>) => void;
}

export const StudentFormTabContent = function StudentFormTabContent({
  formInstanceId,
  studentDraft,
  linkedContact,
  linkedGenderRaw,
  linkedGenderLabel,
  linkedDob,
  excludeIds,
  isGrAutoAssigned,
  grInputDisabled,
  autoGenerateId,
  isCreate,
  nextGrNumber,
  statusSelectOptions,
  statuses,
  onUpdateStatuses,
  fields,
  isFieldEnabled,
  isFieldRequired,
  getFieldError,
  onContactSelect,
  onStudentAvatarChange,
  onGrNumberChange,
  onDraftChange,
}: StudentFormTabContentProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 pb-6">
      {/* Top Section: Contact Association */}
      <StudentContactSection
        contactId={studentDraft.contactId}
        linkedContact={linkedContact}
        excludeIds={excludeIds}
        linkedGenderRaw={linkedGenderRaw}
        linkedGenderLabel={linkedGenderLabel}
        linkedDob={linkedDob}
        genderError={getFieldError("gender")}
        dobError={getFieldError("dob")}
        fields={fields}
        isFieldEnabled={isFieldEnabled}
        isFieldRequired={isFieldRequired}
        getFieldError={getFieldError}
        onContactSelect={onContactSelect}
        onStudentAvatarChange={onStudentAvatarChange}
      />
      <StudentGuardianSection
        formInstanceId={formInstanceId}
        studentDraft={studentDraft}
        linkedContact={linkedContact}
        isFieldEnabled={isFieldEnabled}
      />

      {/* Bottom Section: Entity Details */}
      <StudentRegistrationSection
        studentDraft={studentDraft}
        isGrAutoAssigned={isGrAutoAssigned}
        grInputDisabled={grInputDisabled}
        autoGenerateId={autoGenerateId}
        isCreate={isCreate}
        nextGrNumber={nextGrNumber}
        statusSelectOptions={statusSelectOptions}
        statuses={statuses}
        onUpdateStatuses={onUpdateStatuses}
        fields={fields}
        isFieldEnabled={isFieldEnabled}
        isFieldRequired={isFieldRequired}
        getFieldError={getFieldError}
        onGrNumberChange={onGrNumberChange}
        onDraftChange={onDraftChange}
      />
      {isFieldEnabled("notes") ? (
        <EntityNotesFormSection
          title={t("students.form.notesSection")}
          subtitle={t("students.form.notesSectionDesc")}
          label={resolveStudentFieldLabel(
            fields,
            "registration",
            "notes",
            "students.form.notesLabel",
            t,
          )}
          placeholder={t("students.form.notesPlaceholder")}
          value={studentDraft.notes}
          required={isFieldRequired("notes")}
          onChange={(next) => onDraftChange({ notes: next })}
        />
      ) : null}
    </div>
  );
};
