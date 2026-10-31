import { useState } from "react";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { useTranslation } from "@/hooks/useTranslation";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { BookOpen, FileText } from "lucide-react";
import { EXAMINATIONS_MODULE_MANIFEST, resolveModuleTierTab, type ExamResult } from "@mms/shared";
import { type Exam } from "@/lib/data/examinationData";
import { useExaminationExamColumnLayout } from "@/tenant/features/examinations/hooks/useExaminationExamColumnLayout";
import { useExaminationResultsColumnLayout } from "@/tenant/features/examinations/hooks/useExaminationResultsColumnLayout";
import {
  useExaminationsExams,
  useExaminationsResults,
  useExaminationsMutations,
} from "@/tenant/features/examinations/hooks/useExaminationsApi";
import {
  createExaminationsBulkDeleteHandler,
  createExaminationsBulkRestoreHandler,
  createExaminationsDeleteExamHandler,
  createExaminationsRestoreExamHandler,
  createExaminationsSaveExamHandler,
  createExaminationsSaveResultsHandler,
} from "@/tenant/features/examinations/hooks/examinationsPageControllerActions";

export function useExaminationsPageController() {
  const { t } = useTranslation();
  const {
    canWrite,
    canDelete,
    canReports: canViewReports,
    canViewSetup,
  } = useModulePermissions(EXAMINATIONS_MODULE_MANIFEST);
  const PAGE_TABS = useFilteredModuleTierTabs({
    canViewSetup,
    canViewReports,
    workLabelKey: "nav.examinations",
  });
  const OPS_SUB_TABS = (() => [
    { id: "exams", label: t("examinations.exams"), icon: BookOpen },
    { id: "results", label: t("examinations.results"), icon: FileText },
  ])();
  const [activeTab, setActiveTab] = usePersistedTabState<string>("examinations_active_tab", "work");
  const [activeSubTab, setActiveSubTab] = useState("exams");
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [createExamKey, setCreateExamKey] = useState(0);

  const examsResult = useExaminationsExams({ includeDeleted: showDeleted });
  const resultsResult = useExaminationsResults();
  const examsEnvelope = examsResult.data?.body as Exam[] | { exams?: Exam[] } | null;
  const resultsEnvelope = resultsResult.data?.body as
    ExamResult[] | { results?: ExamResult[] } | null;
  const exams = Array.isArray(examsEnvelope) ? examsEnvelope : (examsEnvelope?.exams ?? []);
  const examResults = Array.isArray(resultsEnvelope)
    ? resultsEnvelope
    : (resultsEnvelope?.results ?? []);
  const {
    replaceExams,
    replaceExamResults,
    deleteExam,
    restoreExam,
    bulkDeleteExams,
    bulkRestoreExams,
  } = useExaminationsMutations();
  const examColumnLayout = useExaminationExamColumnLayout();
  const resultsColumnLayout = useExaminationResultsColumnLayout();

  const [showExamForm, setShowExamForm] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [editExam, setEditExam] = useState<Exam | null>(null);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [showMarksModal, setShowMarksModal] = useState(false);
  const [filteredCount, setFilteredCount] = useState(0);

  const mutationDeps = {
    exams,
    examResults,
    t,
    replaceExams,
    replaceExamResults,
    deleteExam,
    restoreExam,
    bulkDeleteExams,
    bulkRestoreExams,
    setShowExamForm,
    setEditExam,
  };

  const handleSaveExam = createExaminationsSaveExamHandler(mutationDeps);
  const handleSaveResults = createExaminationsSaveResultsHandler(mutationDeps);
  const handleDeleteExam = createExaminationsDeleteExamHandler(mutationDeps);
  const handleRestoreExam = createExaminationsRestoreExamHandler(mutationDeps);
  const handleBulkDelete = createExaminationsBulkDeleteHandler(mutationDeps);
  const handleBulkRestore = createExaminationsBulkRestoreHandler(mutationDeps);

  const effectiveTab = resolveModuleTierTab(
    activeTab,
    PAGE_TABS.map((tab) => tab.id),
  );
  const effectiveSubTab = OPS_SUB_TABS.find((tab) => tab.id === activeSubTab)
    ? activeSubTab
    : "exams";

  useModuleShortcuts({
    searchInputId: "examinations-search-input",
    selectedCount: 0,
    hasActiveFilters: false,
    clearFilters: () => {},
    clearSelection: () => {},
    canWrite,
    showDeleted,
    onCreate: () => {
      setActiveTab("work");
      setActiveSubTab("exams");
      setCreateExamKey((key) => key + 1);
    },
    enabled: activeTab === "work",
  });

  const listLoadFailed = examsResult.isError;

  const openCreateExam = () => {
    setActiveTab("work");
    setActiveSubTab("exams");
    setEditExam(null);
    setShowExamForm(true);
    setCreateExamKey((key) => key + 1);
  };

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
    createExamKey,
    showExamForm,
    setShowExamForm,
    showExamModal,
    setShowExamModal,
    showMarksModal,
    setShowMarksModal,
    editExam,
    setEditExam,
    activeExam,
    setActiveExam,
    filteredCount,
    setFilteredCount,
    exams,
    examResults,
    examColumnLayout,
    resultsColumnLayout,
    listLoadFailed,
    setActiveSubTab,
    handleSaveExam,
    handleSaveResults,
    handleDeleteExam,
    handleRestoreExam,
    handleBulkDelete,
    handleBulkRestore,
    openCreateExam,
    refetchExams: () => {
      void examsResult.refetch();
    },
  };
}
