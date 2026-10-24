import React from "react";
import { BookOpen } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { type Exam } from "@/lib/data/examinationData";
import { useExaminationForm } from "../hooks/useExaminationForm";
import { ExaminationFormFields } from "./ExaminationFormFields";

export interface ExamFormProps {
  open?: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSave: (exam: Exam) => void | Promise<void>;
}

export type ExaminationFormProps = ExamFormProps;

const ExamForm = function ExamForm({
  open = true,
  exam,
  onClose,
  onSave,
}: ExamFormProps): React.JSX.Element {
  const form = useExaminationForm({ open, exam, onClose, onSave });

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={
        exam ? form.t("examinations.form.title.edit") : form.t("examinations.form.title.create")
      }
      icon={BookOpen}
      cancelLabel={form.t("examinations.form.cancel")}
      saveLabel={
        exam ? form.t("examinations.form.saveChanges") : form.t("examinations.form.create")
      }
      error={form.submitError}
      onSave={form.handleSave}
      saving={form.saving}
      saveDisabled={form.saving || !form.valid}
      formId="examination-form"
    >
      <form
        id="examination-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.saving && form.valid) void form.handleSave();
        }}
      >
        <ExaminationFormFields
          t={form.t}
          errors={form.errors}
          examDraft={form.examDraft}
          classes={form.classes}
          updateDraft={form.updateDraft}
          getFieldError={form.getFieldError}
        />
      </form>
    </FormModal>
  );
};
export default ExamForm;
