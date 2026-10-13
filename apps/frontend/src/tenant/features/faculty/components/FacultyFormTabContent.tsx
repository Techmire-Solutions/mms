import type React from "react";
import {
  FacultyContactSection,
  FacultyEmploymentSection,
} from "@/tenant/features/faculty/components/FacultyFormSections";
import { FacultyFormDesignationSection } from "@/tenant/features/faculty/components/FacultyFormDesignationSection";
import { FacultyCustomFieldsSection } from "./FacultyCustomFieldsSection";
import { FacultyFormAllSections } from "./FacultyFormAllSections";
import { type FacultyFormTabContentProps } from "../lib/facultyFormTabs";

export type { FacultyFormTabContentProps };

export const FacultyFormTabContent = function FacultyFormTabContent(
  props: FacultyFormTabContentProps,
): React.JSX.Element {
  const {
    activeTab,
    faculty,
    facultyDraft: facultyDraftProp,
    errors,
    fields,
    linkedFacultyContactIds,
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

  const effectiveFaculty = faculty;
  const effectiveDraft = facultyDraftProp ?? {};
  const effectiveContactIds = linkedFacultyContactIds ?? [];

  let tabBody: React.JSX.Element | null = null;

  if (activeTab === "contact") {
    tabBody = (
      <FacultyContactSection
        facultyDraft={effectiveDraft}
        linkedContact={linkedContact}
        linkedFacultyContactIds={effectiveContactIds}
        errors={errors}
        fields={fields}
        isFieldEnabled={isFieldEnabled}
        isFieldRequired={isFieldRequired}
        onDraftChange={onDraftChange}
      />
    );
  } else if (activeTab === "employment") {
    tabBody = (
      <>
        <FacultyEmploymentSection
          faculty={effectiveFaculty}
          facultyDraft={effectiveDraft}
          errors={errors}
          fields={fields}
          autoGenerateId={autoGenerateId}
          idPrefix={idPrefix}
          nextEmployeeId={nextEmployeeId}
          onRegenerateEmployeeId={onRegenerateEmployeeId}
          isFetchingNextEmployeeId={isFetchingNextEmployeeId}
          statusOptions={statusOptions}
          linkedFacultyContactIds={effectiveContactIds}
          linkedContact={linkedContact}
          isFieldEnabled={isFieldEnabled}
          isFieldRequired={isFieldRequired}
          onDraftChange={onDraftChange}
        />
        <FacultyCustomFieldsSection
          fields={fields}
          draft={effectiveDraft}
          errors={errors}
          onDraftChange={onDraftChange}
        />
      </>
    );
  } else if (activeTab === "designation") {
    tabBody = (
      <FacultyFormDesignationSection
        faculty={effectiveFaculty}
        facultyDraft={effectiveDraft}
        errors={errors}
        fields={fields}
        designationOptions={designationOptions}
        departmentOptions={departmentOptions}
        departmentEntities={departmentEntities}
        isFieldEnabled={isFieldEnabled}
        isFieldRequired={isFieldRequired}
        onDraftChange={onDraftChange}
      />
    );
  }

  if (tabBody) {
    return <div className="space-y-3 pb-6">{tabBody}</div>;
  }

  return (
    <FacultyFormAllSections
      faculty={effectiveFaculty}
      facultyDraft={effectiveDraft}
      errors={errors}
      fields={fields}
      linkedFacultyContactIds={effectiveContactIds}
      departmentOptions={departmentOptions}
      departmentEntities={departmentEntities}
      designationOptions={designationOptions}
      autoGenerateId={autoGenerateId}
      idPrefix={idPrefix}
      nextEmployeeId={nextEmployeeId}
      onRegenerateEmployeeId={onRegenerateEmployeeId}
      isFetchingNextEmployeeId={isFetchingNextEmployeeId}
      statusOptions={statusOptions}
      isFieldEnabled={isFieldEnabled}
      isFieldRequired={isFieldRequired}
      onDraftChange={onDraftChange}
      linkedContact={linkedContact}
    />
  );
};

export default FacultyFormTabContent;
