import React from "react";
import { School } from "lucide-react";
import { FormModal } from "@/components/ui/FormModal";
import { ConfirmAlertDialog } from "@/components/ui/ConfirmAlertDialog";
import type { FacultyMember } from "@mms/shared";
import { FacultyFormTabContent } from "@/tenant/features/faculty/components/FacultyFormTabContent";
import { useFacultyFormController } from "@/tenant/features/faculty/components/useFacultyFormController";
import { FacultyFormFooter } from "@/tenant/features/faculty/components/FacultyFormFooter";
import {
  useFacultyFormTabs,
  type FacultyFormTabKey,
} from "@/tenant/features/faculty/components/facultyFormTabs";

export type { FacultyFormTabKey };

export interface FacultyFormProps {
  faculty?: FacultyMember;
  onClose: () => void;
  onSave: (faculty: FacultyMember) => void | Promise<void>;
  priority?: boolean;
}

export const FacultyForm = function FacultyForm(props: FacultyFormProps): React.JSX.Element {
  const { faculty, onClose, onSave, priority = false } = props;
  const {
    t,
    dir,
    language,
    saving,
    errors,
    facultyDraft,
    isDirty,
    departmentOptions,
    designationOptions,
    statusOptions,
    statusConfig,
    autoGenerateId,
    requireContactLink,
    fieldsMap,
    departmentEntities,
    linkedContact,
    linkedFacultyContactIds,
    idPrefix,
    nextEmployeeId,
    handleRegenerateEmployeeId,
    isFetchingNextEmployeeId,
    formInstanceId,
    isFieldEnabled,
    isFieldRequired,
    getFieldError,
    updateDraft,
    handleSave,
    validationErrorSummary,
    typedDuplicateReason,
    duplicateConfirmOpen,
    handleDuplicateDialogOpenChange,
    confirmDuplicateSave,
    duplicateErrorKeys,
  } = useFacultyFormController({ faculty, onClose, onSave });

  const { activeTab, setActiveTab, visibleTabs } = useFacultyFormTabs({
    isFieldEnabled,
    errors,
    t,
    formInstanceId,
  });

  const onSaveWithTabFocus = async (options?: { keepOpen?: boolean }): Promise<boolean> => {
    return await handleSave(options);
  };

  return (
    <>
      <FormModal<FacultyFormTabKey>
        open
        onClose={onClose}
        title={faculty ? t("faculty.form.editTitle") : t("faculty.form.addTitle")}
        subtitle={t("faculty.form.contactHint")}
        icon={School}
        size="xl"
        tall
        priority={priority}
        lang={language}
        dir={dir}
        tabs={visibleTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        saveOnTabChange={false}
        cancelLabel={t("common.cancel")}
        saveLabel={
          saving
            ? t("faculty.form.saving")
            : faculty
              ? t("faculty.form.saveUpdate")
              : t("faculty.form.saveCreate")
        }
        onSave={onSaveWithTabFocus}
        isDirty={isDirty}
        saving={saving}
        discardUnsavedTitle={t("faculty.form.discardUnsavedTitle")}
        discardUnsavedDescription={t("faculty.form.discardUnsavedDescription")}
        discardConfirmLabel={t("faculty.form.discardChanges")}
        discardCancelLabel={t("faculty.form.keepEditing")}
        error={validationErrorSummary}
        saveDisabled={
          (requireContactLink && !facultyDraft.contactId) || (Boolean(faculty?.id) && !isDirty)
        }
        footerStart={
          <FacultyFormFooter
            linkedContact={linkedContact}
            facultyDraft={facultyDraft}
            requireContactLink={requireContactLink}
            statusConfig={statusConfig}
            t={t}
          />
        }
        formId={formInstanceId}
      >
        <form
          id={formInstanceId}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!(
              (requireContactLink && !facultyDraft.contactId) ||
              (Boolean(faculty?.id) && !isDirty)
            )) {
              void onSaveWithTabFocus();
            }
          }}
        >
          <FacultyFormTabContent
            formInstanceId={formInstanceId}
            activeTab={activeTab}
            faculty={faculty}
            facultyDraft={facultyDraft}
            errors={errors}
            fields={fieldsMap}
            linkedFacultyContactIds={linkedFacultyContactIds}
            departmentOptions={departmentOptions}
            departmentEntities={departmentEntities}
            designationOptions={designationOptions}
            autoGenerateId={autoGenerateId}
            idPrefix={idPrefix}
            nextEmployeeId={nextEmployeeId}
            onRegenerateEmployeeId={handleRegenerateEmployeeId}
            isFetchingNextEmployeeId={isFetchingNextEmployeeId}
            statusOptions={statusOptions}
            isFieldEnabled={isFieldEnabled}
            isFieldRequired={isFieldRequired}
            getFieldError={getFieldError}
            onDraftChange={updateDraft}
            linkedContact={linkedContact}
          />
        </form>
      </FormModal>
      <ConfirmAlertDialog
        open={duplicateConfirmOpen}
        onOpenChange={handleDuplicateDialogOpenChange}
        title={faculty ? t("faculty.form.editTitle") : t("faculty.form.addTitle")}
        description={
          typedDuplicateReason
            ? t("faculty.form.duplicateSaveWarning", {
                message: t(duplicateErrorKeys[typedDuplicateReason]),
              })
            : ""
        }
        confirmLabel={t("faculty.form.saveAnyway")}
        cancelLabel={t("faculty.form.reviewDuplicate")}
        onConfirm={confirmDuplicateSave}
      />
    </>
  );
};

export { FacultyForm as FacultyFormModal };
export default FacultyForm;
