import { ClipboardList, FileText, Library, Plus } from "lucide-react";
import { FormModal, type FormModalTab } from "@/components/ui/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import {
  PaperBuilder,
  type PaperBuilderTab,
} from "@/tenant/features/question-bank/components/PaperBuilder";
import { QuestionForm } from "@/tenant/features/question-bank/components/QuestionForm";
import type { QuestionBankQuestion, QuestionBankTest } from "@mms/shared";

interface QuestionBankModalLayerProps {
  canWrite: boolean;
  showDeleted: boolean;
  paperBuilderOpen: boolean;
  paperBuilderSession: number;
  paperBuilderTab: PaperBuilderTab;
  questions: QuestionBankQuestion[];
  tests: QuestionBankTest[];
  showQuestionModal: boolean;
  editQuestion: QuestionBankQuestion | null;
  onClosePaperBuilder: () => void;
  onPaperBuilderTabChange: (tab: PaperBuilderTab) => void;
  onSaveTest: (test: QuestionBankTest) => Promise<void>;
  onCloseQuestion: () => void;
  onSaveQuestion: (question: QuestionBankQuestion) => Promise<void>;
}

export function QuestionBankModalLayer({
  canWrite,
  showDeleted,
  paperBuilderOpen,
  paperBuilderSession,
  paperBuilderTab,
  questions,
  tests,
  showQuestionModal,
  editQuestion,
  onClosePaperBuilder,
  onPaperBuilderTabChange,
  onSaveTest,
  onCloseQuestion,
  onSaveQuestion,
}: QuestionBankModalLayerProps) {
  const { t } = useTranslation();
  const paperBuilderTabs: FormModalTab<PaperBuilderTab>[] = [
    { key: "details", label: t("questionBank.paperDetails"), icon: FileText },
    { key: "saved", label: t("questionBank.savedPapers"), icon: Library },
    { key: "sections", label: t("questionBank.paperSections"), icon: ClipboardList },
    { key: "questions", label: t("questionBank.addQuestionsFromBank"), icon: Plus },
    { key: "preview", label: t("questionBank.paperPreview"), icon: FileText },
  ];

  return (
    <>
      {canWrite && !showDeleted && (
        <FormModal
          open={paperBuilderOpen}
          onClose={onClosePaperBuilder}
          title={t("questionBank.generatorTitle")}
          subtitle={t("questionBank.manualPaperGeneratorSubtitle")}
          icon={FileText}
          size="xl"
          hideFooter
          tabs={paperBuilderTabs}
          activeTab={paperBuilderTab}
          onTabChange={onPaperBuilderTabChange}
          panelClassName="h-modal-2xl max-w-modal-mobile rounded-xl sm:h-modal-xl sm:max-w-modal-sm sm:rounded-2xl xl:max-w-6xl"
        >
          <PaperBuilder
            key={paperBuilderSession}
            questions={questions}
            tests={tests}
            activeTab={paperBuilderTab}
            showHeader={false}
            onSaveTest={onSaveTest}
          />
        </FormModal>
      )}

      {canWrite && !showDeleted && (
        <QuestionForm
          open={showQuestionModal}
          question={editQuestion}
          questions={questions}
          onClose={onCloseQuestion}
          onSave={onSaveQuestion}
        />
      )}
    </>
  );
}
