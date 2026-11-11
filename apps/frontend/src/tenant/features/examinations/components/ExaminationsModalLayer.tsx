import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { FormModal } from "@/components/app/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import ExaminationForm from "@/tenant/features/examinations/components/ExaminationForm";
import { EnterMarks } from "@/tenant/features/examinations/components/EnterMarks";
import type { Exam, ExamResult } from "@/lib/data/examinationData";

export interface ExaminationsModalLayerProps {
  canWrite: boolean;
  showDeleted: boolean;
  showExamForm: boolean;
  showMarksModal: boolean;
  editExam: Exam | null;
  exams: Exam[];
  examResults: ExamResult[];
  onCloseExamForm: () => void;
  onSaveExam: (exam: Exam) => Promise<void>;
  onCloseMarks: () => void;
  onSaveResults: (examId: string, results: ExamResult[]) => Promise<void>;
}

export function ExaminationsModalLayer({
  canWrite,
  showDeleted,
  showExamForm,
  showMarksModal,
  editExam,
  exams,
  examResults,
  onCloseExamForm,
  onSaveExam,
  onCloseMarks,
  onSaveResults,
}: ExaminationsModalLayerProps): React.JSX.Element {
  const { t } = useTranslation();
  const [marksDirty, setMarksDirty] = useState(false);

  return (
    <>
      <AnimatePresence>
        {showExamForm && canWrite && !showDeleted && (
          <ExaminationForm
            open={showExamForm}
            exam={editExam}
            onClose={onCloseExamForm}
            onSave={onSaveExam}
          />
        )}
      </AnimatePresence>

      {canWrite && !showDeleted && (
        <FormModal
          open={showMarksModal}
          title={t("examinations.marks")}
          size="xl"
          hideFooter
          panelClassName="h-modal-tall max-h-modal-tall"
          isDirty={marksDirty}
          discardUnsavedTitle={t("settings.unsavedChanges")}
          discardUnsavedDescription={t("examinations.enterMarks.unsavedConfirm")}
          discardConfirmLabel={t("common.yes")}
          discardCancelLabel={t("common.cancel")}
          onClose={() => {
            setMarksDirty(false);
            onCloseMarks();
          }}
        >
          <EnterMarks
            exams={exams}
            results={examResults}
            onSaveResults={onSaveResults}
            onDirtyChange={setMarksDirty}
          />
        </FormModal>
      )}
    </>
  );
}
