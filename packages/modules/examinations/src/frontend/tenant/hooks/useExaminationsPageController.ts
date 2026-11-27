import { useMemo, useState } from "react";
import { usePersistedTabState } from "@mms/fe-core/lib/usePersistedTabState";
import { useModuleShortcuts } from "@mms/fe-core/lib/useModuleShortcuts";
import { EXAMINATIONS_WORK_SEARCH_INPUT_ID } from "../components/ExaminationsListFilters";
import { useTranslation } from "@mms/fe-core/i18n";
import { useDirectoryTrashState } from "@mms/fe-core/lib/useDirectoryTrashState";
import { useFilteredModuleTierTabs } from "@mms/fe-core/lib/useModuleTierTabs";
import { useModulePermissions } from "../host/usePermissions";
import { BookOpen, FileText } from "lucide-react";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  examsFromResponse,
  resolveModuleTierTab,
} from "@mms/contracts";
import { type Exam } from "@mms/contracts";
import { useExaminationExamColumnLayout } from "./useExaminationExamColumnLayout";
import { useExaminationResultsColumnLayout } from "./useExaminationResultsColumnLayout";
import {
  useExaminationsExams,
  useExaminationsResults,
  useExaminationsMutations,
} from "./useExaminationsApi";
import {
  createExaminationsBulkDeleteHandler,
  createExaminationsBulkRestoreHandler,
  createExaminationsDeleteExamHandler,
  createExaminationsRestoreExamHandler,
  createExaminationsSaveExamHandler,
  createExaminationsSaveResultsHandler,
} from "./examinationsPageControllerActions";

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
  const OPS_SUB_TABS = useMemo(
    () => [
      { id: "exams", label: t("examinations.exams"), icon: BookOpen },
      { id: "results", label: t("examinations.results"), icon: FileText },
    ],
    [t],
  );
  const [activeTab, setActiveTab] = usePersistedTabState<string>("examinations_active_tab", "work");
  const [activeSubTab, setActiveSubTab] = useState("exams");
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [createExamKey, setCreateExamKey] = useState(0);

  const examsResult = useExaminationsExams({ includeDeleted: showDeleted });
  const resultsResult = useExaminationsResults();
  const exams = examsFromResponse(examsResult.data?.body);
  const examResults = resultsResult.data?.body?.results ?? [];
  // The marks walker caps at 20×500; when it stops there, rankings/averages are incomplete.
  const resultsTruncated = resultsResult.data?.body?.hasMore === true;
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
    PAGE_TABS.map((tab: any) => tab.id),
  );
  const effectiveSubTab = OPS_SUB_TABS.find((tab: any) => tab.id === activeSubTab)
    ? activeSubTab
    : "exams";

  useModuleShortcuts({
    searchInputId: EXAMINATIONS_WORK_SEARCH_INPUT_ID,
    selectedCount: 0,
    hasActiveFilters: false,
    clearFilters: () => {},
    clearSelection: () => {},
    canWrite: canDelete,
    showDeleted,
    onCreate: () => {
      setActiveTab("work");
      setActiveSubTab("exams");
      setCreateExamKey((key: any) => key + 1);
    },
    enabled: activeTab === "work",
  });

  const listLoadFailed = examsResult.isError;

  const openCreateExam = () => {
    setActiveTab("work");
    setActiveSubTab("exams");
    setEditExam(null);
    setShowExamForm(true);
    setCreateExamKey((key: any) => key + 1);
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
    resultsTruncated,
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
