import React from "react";
import { GraduationCap } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { Alert } from "@/components/app/Alert";
import { StatusBadge } from "@/components/app/StatusBadge";
import { FormFooterEntityChip } from "@/components/app/FormFooterChip";
import { Badge } from "@/components/ui/badge";
import { StudentFormTabContent } from "@/tenant/features/students/components/StudentFormTabContent";
import { useStudentFormState } from "@/tenant/features/students/hooks/useStudentFormState";
import type { Student } from "@mms/shared";

export interface StudentFormProps {
  student?: Partial<Student> | null;
  onClose: () => void;
  onSave: (student: Student) => void | Promise<void>;
  priority?: boolean;
}

export const StudentForm = function StudentForm({
  student,
  onClose,
  onSave,
  priority = false,
}: StudentFormProps): React.JSX.Element {
  const form = useStudentFormState({ student, onClose, onSave });

  const footerStart = form.linkedContact?.name ? (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <FormFooterEntityChip>{form.linkedContact.name}</FormFooterEntityChip>
      <div className="flex items-center gap-1.5">
        {form.isFieldEnabled("grNumber") && form.studentDraft.grNumber ? (
          <Badge
            as="span"
            size="sm"
            tone="primary"
            className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
          >
            {form.t("students.grPrefix")}: {form.studentDraft.grNumber}
          </Badge>
        ) : null}
        {form.isFieldEnabled("status") ? (
          <StatusBadge
            status={form.studentDraft.status || "active"}
            size="sm"
            config={form.statusBadgeConfig}
          />
        ) : null}
      </div>
    </div>
  ) : form.isFieldEnabled("contactId") ? (
    <Alert
      tone="destructive"
      density="compact"
      description={form.t("students.form.contactRequired")}
    />
  ) : null;

  return (
    <>
      <FormModal
        open
        onClose={onClose}
        title={student ? form.t("students.form.editTitle") : form.t("students.form.addTitle")}
        subtitle={form.t("students.form.subtitle")}
        icon={GraduationCap}
        tall
        priority={priority}
        lang={form.language}
        dir={form.dir}
        cancelLabel={form.t("common.cancel")}
        saveLabel={
          form.saving
            ? form.t("students.form.saving")
            : student
              ? form.t("students.form.saveUpdate")
              : form.t("students.form.saveRegister")
        }
        onSave={form.handleSave}
        isDirty={form.isDirty}
        saving={form.saving}
        discardUnsavedTitle={form.t("students.form.discardUnsavedTitle")}
        discardUnsavedDescription={form.t("students.form.discardUnsavedDescription")}
        discardConfirmLabel={form.t("students.form.discardChanges")}
        discardCancelLabel={form.t("students.form.keepEditing")}
        saveDisabled={
          (form.isFieldEnabled("contactId") && !form.studentDraft.contactId) ||
          (Boolean(student?.id) && !form.isDirty)
        }
        error={form.validationErrorSummary ?? (form.errorSummary || undefined)}
        footerStart={footerStart}
        formId={form.formInstanceId}
      >
        <form
          id={form.formInstanceId}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!(
              (form.isFieldEnabled("contactId") && !form.studentDraft.contactId) ||
              (Boolean(student?.id) && !form.isDirty)
            )) {
              void form.handleSave();
            }
          }}
        >
          <StudentFormTabContent
            formInstanceId={form.formInstanceId}
            studentDraft={form.studentDraft}
            linkedContact={form.linkedContact}
            linkedGenderRaw={form.linkedGenderRaw}
            linkedGenderLabel={form.linkedGenderLabel}
            linkedDob={form.linkedDob}
            excludeIds={form.excludeIds}
            isGrAutoAssigned={form.isGrAutoAssigned}
            grInputDisabled={form.grInputDisabled}
            autoGenerateId={form.autoGenerateId}
            isCreate={form.isCreate}
            nextGrNumber={form.nextGrNumber}
            statusSelectOptions={form.statusSelectOptions}
            statuses={form.statuses}
            onUpdateStatuses={form.onUpdateStatuses}
            fields={form.fields}
            isFieldEnabled={form.isFieldEnabled}
            isFieldRequired={form.isFieldRequired}
            getFieldError={form.getFieldError}
            onContactSelect={form.handleContactSelect}
            onStudentAvatarChange={form.handleStudentAvatarChange}
            onGrNumberChange={form.handleGrNumberChange}
            onDraftChange={form.updateDraft}
          />
        </form>
      </FormModal>
      <ConfirmAlertDialog
        open={form.duplicateConfirmOpen}
        onOpenChange={form.handleDuplicateDialogOpenChange}
        title={student ? form.t("students.form.editTitle") : form.t("students.form.addTitle")}
        description={
          form.typedDuplicateReason
            ? form.t("students.form.duplicateSaveWarning", {
                message: form.t(form.duplicateErrorKeys[form.typedDuplicateReason]),
              })
            : ""
        }
        confirmLabel={form.t("students.form.saveAnyway")}
        cancelLabel={form.t("students.form.reviewDuplicate")}
        onConfirm={form.confirmDuplicateSave}
      />
    </>
  );
};
export { StudentForm as StudentFormModal };
export default StudentForm;
