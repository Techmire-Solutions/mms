import React from "react";
import type {
  Contact,
  FacultyDepartmentEntity,
  FacultyDesignationDefinition,
  FacultyMember,
  FieldDefinition,
} from "@mms/shared";
import {
  FacultyContactSection,
  FacultyEmploymentSection,
  type FacultyStatusOption,
} from "@/tenant/features/faculty/components/FacultyFormSections";
import { FacultyIjazahSection } from "@/tenant/features/faculty/components/FacultyIjazahSection";
import { FacultyFormDesignationSection } from "@/tenant/features/faculty/components/FacultyFormDesignationSection";

export interface FacultyFormAllSectionsProps {
  faculty?: FacultyMember;
  facultyDraft?: Partial<FacultyMember>;
  errors: Record<string, string>;
  fields: Record<string, FieldDefinition[]>;
  linkedFacultyContactIds?: Array<string | number>;
  departmentOptions?: string[];
  departmentEntities?: FacultyDepartmentEntity[];
  designationOptions?: FacultyDesignationDefinition[];
  autoGenerateId: boolean;
  idPrefix: string;
  nextEmployeeId?: string;
  onRegenerateEmployeeId?: () => void;
  isFetchingNextEmployeeId?: boolean;
  statusOptions: FacultyStatusOption[];
  isFieldEnabled: (fieldId: string) => boolean;
  isFieldRequired: (fieldId: string) => boolean;
  onDraftChange: (patch: Partial<FacultyMember>) => void;
  linkedContact?: Contact | null;
}

export function FacultyFormAllSections(props: FacultyFormAllSectionsProps): React.JSX.Element {
  const {
    faculty,
    facultyDraft = {},
    linkedFacultyContactIds = [],
    errors,
    fields,
    departmentOptions,
    departmentEntities,
    designationOptions,
    autoGenerateId,
    idPrefix,
    nextEmployeeId,
    onRegenerateEmployeeId,
    isFetchingNextEmployeeId,
    statusOptions,
    isFieldEnabled,
    isFieldRequired,
    onDraftChange,
    linkedContact,
  } = props;

  return (
    <div className="space-y-3 pb-6">
      <FacultyContactSection
        facultyDraft={facultyDraft}
        linkedContact={linkedContact}
        linkedFacultyContactIds={linkedFacultyContactIds}
        errors={errors}
        fields={fields}
        isFieldEnabled={isFieldEnabled}
        isFieldRequired={isFieldRequired}
        onDraftChange={onDraftChange}
      />

      <FacultyIjazahSection
        ijazahs={facultyDraft.ijazahs}
        onChange={(ijazahs) => onDraftChange({ ijazahs })}
      />

      <FacultyEmploymentSection
        faculty={faculty}
        facultyDraft={facultyDraft}
        errors={errors}
        fields={fields}
        autoGenerateId={autoGenerateId}
        idPrefix={idPrefix}
        nextEmployeeId={nextEmployeeId}
        onRegenerateEmployeeId={onRegenerateEmployeeId}
        isFetchingNextEmployeeId={isFetchingNextEmployeeId}
        statusOptions={statusOptions}
        linkedFacultyContactIds={linkedFacultyContactIds}
        linkedContact={linkedContact}
        isFieldEnabled={isFieldEnabled}
        isFieldRequired={isFieldRequired}
        onDraftChange={onDraftChange}
      />

      <FacultyFormDesignationSection
        faculty={faculty}
        facultyDraft={facultyDraft}
        errors={errors}
        fields={fields}
        designationOptions={designationOptions}
        departmentOptions={departmentOptions}
        departmentEntities={departmentEntities}
        showCollectionTitle
        isFieldEnabled={isFieldEnabled}
        isFieldRequired={isFieldRequired}
        onDraftChange={onDraftChange}
      />
    </div>
  );
}
