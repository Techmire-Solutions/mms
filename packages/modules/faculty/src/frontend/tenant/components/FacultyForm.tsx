import React from "react";
import { School } from "lucide-react";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { ConfirmAlertDialog } from "@mms/fe-core/components/ConfirmAlertDialog";
import type { FacultyMember } from "@mms/contracts";
import { FacultyFormTabContent } from "./FacultyFormTabContent";
import { useFacultyFormController } from "../hooks/useFacultyFormController";
import { FacultyFormFooter } from "./FacultyFormFooter";
import { useFacultyFormTabs, type FacultyFormTabKey } from "../lib/facultyFormTabs";

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
    missingRequiredPhone,
    missingRequiredEmail,
    fieldsMap,
    departmentEntities,
    linkedContact,
    linkedFacultyContactIds,
    linkedUser,
    userAccountDraft,
    setUserAccountDraft,
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
          (requireContactLink && !facultyDraft.contactId) ||
          missingRequiredPhone ||
          missingRequiredEmail ||
          (Boolean(faculty?.id) && !isDirty)
        }
        footerStart={
          <FacultyFormFooter
            linkedContact={linkedContact}
            facultyDraft={facultyDraft}
            requireContactLink={requireContactLink}
            missingRequiredPhone={missingRequiredPhone}
            missingRequiredEmail={missingRequiredEmail}
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
            if (
              !saving &&
              !(
                (requireContactLink && !facultyDraft.contactId) ||
                missingRequiredPhone ||
                missingRequiredEmail ||
                (Boolean(faculty?.id) && !isDirty)
              )
            ) {
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
            linkedUser={linkedUser}
            userAccountDraft={userAccountDraft}
            onUserAccountDraftChange={setUserAccountDraft}
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
