import { useCallback, useState, useEffect } from "react";
import { useModuleShortcuts } from "@mms/fe-core/lib/useModuleShortcuts";
import { QUESTION_BANK_WORK_SEARCH_INPUT_ID } from "../components/QuestionsListFilters";
import { useTranslation } from "@mms/fe-core/i18n";
import { useDirectoryTrashState } from "@mms/fe-core/lib/useDirectoryTrashState";
import { useFilteredModuleTierTabs } from "@mms/fe-core/lib/useModuleTierTabs";
import { useModulePermissions } from "../host/usePermissions";
import { usePersistedTabState } from "@mms/fe-core/lib/usePersistedTabState";
import { useWorkSelection } from "@mms/fe-core/hooks/useWorkSelection";
import { useQuestionBankConfig } from "./useQuestionBankConfig";
import { ClipboardList, FileText } from "lucide-react";
import {
  QUESTION_BANK_MODULE_MANIFEST,
  resolveModuleTierTab,
  type QuestionBankQuestion,
  type QuestionBankTest,
  type QuestionStatus,
} from "@mms/contracts";
import { useQuestionBankColumnLayout } from "./useQuestionBankColumnLayout";
import {
  useQuestionBankQuestions,
  useQuestionBankQuestionsCollection,
  useQuestionBankTestsCollection,
  useQuestionBankResultsCollection,
  useQuestionBankMutations,
} from "./useQuestionBankApi";
import { useQuestionBankTrashActions } from "./useQuestionBankTrashActions";
import { useQuestionBankModalState } from "./useQuestionBankModalState";
import { notify } from "@mms/fe-core/notify";

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
    setQuestionStatus,
    duplicateQuestion,
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

  // Stable now that usePersistedTabState returns memoized setters and the modal
  // callbacks are useCallback'd — keeps the create-hotkey listener registered once.
  const { openAddQuestion: openAddQuestionModal, openCreatePaper: openCreatePaperModal } =
    modalState;
  const openAddQuestion = useCallback(
    () => openAddQuestionModal(setActiveTab, setActiveSubTab),
    [openAddQuestionModal, setActiveTab, setActiveSubTab],
  );
  const openCreatePaper = useCallback(
    () => openCreatePaperModal(setActiveTab, setActiveSubTab),
    [openCreatePaperModal, setActiveTab, setActiveSubTab],
  );

  const handleSetQuestionStatus = async (
    question: QuestionBankQuestion,
    status: QuestionStatus,
  ): Promise<void> => {
    try {
      await setQuestionStatus.mutateAsync(question.id, status);
      modalState.setActiveQuestion(null);
    } catch (error) {
      notify.error(t("questionBank.statusChangeFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleDuplicateQuestion = async (question: QuestionBankQuestion): Promise<void> => {
    try {
      await duplicateQuestion.mutateAsync(question.id);
      modalState.setActiveQuestion(null);
    } catch (error) {
      notify.error(t("questionBank.duplicateFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleQuestionSave = async (question: QuestionBankQuestion): Promise<void> => {
    // The bulk endpoint is an upsert; send only the saved record so one edit does not upload the
    // whole collection (and does not widen the OCC window for unrelated rows).
    await replaceQuestions.mutateAsync([question]);
    modalState.closeQuestionModal();
  };

  const handleSaveTest = async (test: QuestionBankTest) => {
    await replaceTests.mutateAsync([test]);
  };

  const effectiveTab = resolveModuleTierTab(
    activeTab,
    PAGE_TABS.map((tab: any) => tab.id),
  );
  const effectiveSubTab = OPS_SUB_TABS.find((tab: any) => tab.id === activeSubTab)
    ? activeSubTab
    : "questions";
  const listLoadFailed = questionsResult.isError;

  // The questions list reports its own filtered count; every other tab shows the full collection.
  const isQuestionListTab = effectiveTab === "work" && effectiveSubTab === "questions";
  const filteredCount = isQuestionListTab ? reportedFilteredCount : questions.length;

  useModuleShortcuts({
    searchInputId: QUESTION_BANK_WORK_SEARCH_INPUT_ID,
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
    handleSetQuestionStatus,
    handleDuplicateQuestion,
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
