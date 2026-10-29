import { useCallback, useState, useEffect } from "react";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { useTranslation } from "@/hooks/useTranslation";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import { ClipboardList, FileText } from "lucide-react";
import {
  QUESTION_BANK_MODULE_MANIFEST,
  resolveModuleTierTab,
  type QuestionBankQuestion,
  type QuestionBankTest,
} from "@mms/shared";
import { useQuestionBankColumnLayout } from "@/tenant/features/question-bank/hooks/useQuestionBankColumnLayout";
import {
  useQuestionBankQuestions,
  useQuestionBankQuestionsCollection,
  useQuestionBankTestsCollection,
  useQuestionBankResultsCollection,
  useQuestionBankMutations,
} from "@/tenant/features/question-bank/hooks/useQuestionBankApi";
import { useQuestionBankTrashActions } from "@/tenant/features/question-bank/hooks/useQuestionBankTrashActions";
import { useQuestionBankModalState } from "./useQuestionBankModalState";

export function useQuestionBankPageController() {
  const { t } = useTranslation();
  const {
    canWrite,
    canDelete,
    canReports: canViewReports,
    canViewSetup,
  } = useModulePermissions(QUESTION_BANK_MODULE_MANIFEST);
  const PAGE_TABS = useFilteredModuleTierTabs({
    canViewSetup,
    canViewReports,
    workLabelKey: "nav.questionBank",
  });
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const questionsResult = useQuestionBankQuestions({ includeDeleted: showDeleted });
  const questions = useQuestionBankQuestionsCollection({ includeDeleted: showDeleted });
  const tests = useQuestionBankTestsCollection();
  const questionBankResults = useQuestionBankResultsCollection();
  const questionBankConfig = useQuestionBankConfig(questions);
  const OPS_SUB_TABS = (() => [
    { id: "questions", label: t("questionBank.questions"), icon: ClipboardList },
    ...(canWrite && !showDeleted
      ? [{ id: "generate", label: t("questionBank.generator"), icon: FileText }]
      : []),
  ])();
  const [activeTab, setActiveTab] = usePersistedTabState<string>(
    "question_bank_active_tab",
    "work",
  );
  const [activeSubTab, setActiveSubTab] = usePersistedTabState<string>(
    "question_bank_ops_subtab",
    "questions",
  );
  const modalState = useQuestionBankModalState();
  const [reportedFilteredCount, setFilteredCount] = useState(0);
  const columnLayout = useQuestionBankColumnLayout();
  const questionSelection = useWorkSelection<string>();

  const {
    replaceQuestions,
    replaceTests,
    deleteQuestion,
    restoreQuestion,
    bulkDeleteQuestions,
    bulkRestoreQuestions,
  } = useQuestionBankMutations();

  const {
    handleDeleteQuestion,
    handleRestoreQuestion,
    handleBulkDelete: rawBulkDelete,
    handleBulkRestore: rawBulkRestore,
  } = useQuestionBankTrashActions({
    deleteQuestion,
    restoreQuestion,
    bulkDeleteQuestions,
    bulkRestoreQuestions,
  });

  const { clearSelection: clearQuestionSelection } = questionSelection;

  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      await rawBulkDelete(ids);
      clearQuestionSelection();
    },
    [rawBulkDelete, clearQuestionSelection],
  );

  const handleBulkRestore = useCallback(
    async (ids: string[]) => {
      await rawBulkRestore(ids);
      clearQuestionSelection();
    },
    [rawBulkRestore, clearQuestionSelection],
  );

  useEffect(() => {
    clearQuestionSelection();
  }, [showDeleted, clearQuestionSelection]);

  const setQuestions = useCallback(
    async (updater: typeof questions | ((prev: typeof questions) => typeof questions)) => {
      const nextQuestions = typeof updater === "function" ? updater(questions) : updater;
      await replaceQuestions.mutateAsync(nextQuestions);
    },
    [questions, replaceQuestions],
  );

  const openAddQuestion = () => modalState.openAddQuestion(setActiveTab, setActiveSubTab);
  const openCreatePaper = () => modalState.openCreatePaper(setActiveTab, setActiveSubTab);

  const handleQuestionSave = async (question: QuestionBankQuestion): Promise<void> => {
    const existingQuestion = questions.find((questionItem) => questionItem.id === question.id);
    await setQuestions(
      existingQuestion
        ? questions.map((questionItem) =>
            questionItem.id === question.id ? question : questionItem,
          )
        : [...questions, question],
    );
    modalState.closeQuestionModal();
  };

  const handleSaveTest = async (test: QuestionBankTest) => {
    await replaceTests.mutateAsync(
      tests.some((paper) => paper.id === test.id)
        ? tests.map((paper) => (paper.id === test.id ? test : paper))
        : [...tests, test],
    );
  };

  const effectiveTab = resolveModuleTierTab(
    activeTab,
    PAGE_TABS.map((tab) => tab.id),
  );
  const effectiveSubTab = OPS_SUB_TABS.find((tab) => tab.id === activeSubTab)
    ? activeSubTab
    : "questions";
  const listLoadFailed = questionsResult.isError;

  // The questions list reports its own filtered count; every other tab shows the full collection.
  const isQuestionListTab = effectiveTab === "work" && effectiveSubTab === "questions";
  const filteredCount = isQuestionListTab ? reportedFilteredCount : questions.length;

  useModuleShortcuts({
    searchInputId: "question-bank-search-input",
    selectedCount: questionSelection.selectedIds.length,
    hasActiveFilters: false,
    clearFilters: () => {},
    clearSelection: questionSelection.clearSelection,
    canWrite,
    showDeleted,
    onCreate: openAddQuestion,
    enabled: canWrite && !showDeleted && effectiveTab === "work" && effectiveSubTab === "questions",
  });

  return {
    t,
    canWrite,
    canDelete,
    PAGE_TABS,
    OPS_SUB_TABS,
    activeTab,
    setActiveTab,
    effectiveTab,
    effectiveSubTab,
    showDeleted,
    setShowDeleted,
    filteredCount,
    setFilteredCount,
    ...modalState,
    columnLayout,
    questions,
    tests,
    questionBankResults,
    questionBankConfig,
    listLoadFailed,
    questionSelection,
    setActiveSubTab,
    openAddQuestion,
    openCreatePaper,
    handleQuestionSave,
    closeQuestionModal: modalState.closeQuestionModal,
    handleDeleteQuestion,
    handleRestoreQuestion,
    handleBulkDelete,
    handleBulkRestore,
    handleSaveTest,
    setQuestions,
    refetchQuestions: () => {
      void questionsResult.refetch();
    },
  };
}
