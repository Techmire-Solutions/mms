import type { Contact, FieldDefinition, Student } from "@mms/contracts";
import {
  StudentContactSection,
  StudentGuardianSection,
  StudentRegistrationSection,
  type StudentFieldErrorGetter,
  type StudentStatusSelectOption,
} from "./StudentFormSections";
import { StudentCustomFieldsSection } from "./StudentCustomFieldsSection";
import { EntityNotesFormSection } from "@mms/fe-core/components/EntityNotesFormSection";
import { useTranslation } from "@mms/fe-core/i18n";
import { resolveStudentFieldLabel } from "./StudentFormSectionShared";
import React from "react";

export interface StudentFormTabContentProps {
  formInstanceId: string;
  studentDraft: Partial<Student>;
  linkedContact?: Contact | null;
  linkedGenderRaw?: string;
  linkedGenderLabel: string;
  linkedDob: string;
  rawDob?: string;
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
  onStudentDobChange?: (dob: string) => void | Promise<void>;
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
  rawDob,
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
  onStudentDobChange,
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
        rawDob={rawDob}
        genderError={getFieldError("gender")}
        dobError={getFieldError("dob")}
        fields={fields}
        isFieldEnabled={isFieldEnabled}
        isFieldRequired={isFieldRequired}
        getFieldError={getFieldError}
        onContactSelect={onContactSelect}
        onStudentAvatarChange={onStudentAvatarChange}
        onStudentDobChange={onStudentDobChange}
        formInstanceId={formInstanceId}
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
      <StudentCustomFieldsSection
        fields={fields}
        draft={studentDraft}
        getFieldError={getFieldError}
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
