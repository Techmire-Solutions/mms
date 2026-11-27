import { todayISO } from "@mms/contracts";
import { useAttendanceMetrics } from "../../host/collections";
import { useFinanceMetrics } from "../../host/collections";
import { useAccountingMetrics } from "../../host/collections";
import { useObligationsMetrics } from "../../host/collections";
import { useUsersMetrics } from "../../host/collections";
import { useMessagingMetrics } from "../../host/collections";
import { useExaminationsMetrics } from "../../host/collections";
import { useHasanatMetrics } from "../../host/collections";
import {
  useQuestionBankMetrics,
  useQuestionBankQuestionsCollection,
  useQuestionBankResultsCollection,
  useQuestionBankTestsCollection,
} from "../../host/collections";
import { useSessionsMetrics } from "../../host/collections";
import { useContactsReportAnalytics } from "../../host/collections";
import { useStudentsMetrics } from "../../host/collections";
import { useFacultyMetrics } from "../../host/collections";
import type { KpiCategoryFlags } from "../../components/kpiSummaryCategoryFlags";

export type KpiSummaryDataSources = ReturnType<typeof useKpiSummaryDataSources>;

/**
 * Loads server `/metrics` for standard report KPIs.
 * Question Bank collections load only for avg-score (not available on metrics yet).
 * Other non-person dumps live in `useKpiSummaryCustomCards` when custom cards need them.
 */
export function useKpiSummaryDataSources(category: string, flags: KpiCategoryFlags) {
  const {
    isContactsCategory,
    isStudentsCategory,
    isFacultyCategory,
    isObligationsCategory,
    isAccountingCategory,
    isUsersCategory,
    isMessagingCategory,
    needsContactAnalytics,
  } = flags;

  const isAttendance = category === "attendance";
  const isFinancial = category === "financial" || category === "finance";
  const isHasanat = category === "hasanat";
  const isSessions = category === "sessions" || category === "enrollments";
  const isExaminations = category === "examinations" || category === "students";
  const isQuestionBank = category === "questionBank";

  const { data: contactsReportData } = useContactsReportAnalytics({
    enabled: needsContactAnalytics,
  });
  const { data: studentMetrics } = useStudentsMetrics({
    enabled: isStudentsCategory || category === "enrollments",
  });
  const { data: facultyMetrics } = useFacultyMetrics({
    enabled: isFacultyCategory || category === "enrollments",
  });
  const { data: crossStudentMetrics } = useStudentsMetrics({
    enabled:
      !isStudentsCategory &&
      !isContactsCategory &&
      !isFacultyCategory &&
      category !== "enrollments",
  });
  const { data: crossFacultyMetrics } = useFacultyMetrics({
    enabled: !isFacultyCategory && category !== "enrollments",
  });

  const { data: attendanceMetrics } = useAttendanceMetrics(todayISO(), { enabled: isAttendance });
  const { data: financeMetrics } = useFinanceMetrics({ enabled: isFinancial });
  const { data: accountingMetrics } = useAccountingMetrics({ enabled: isAccountingCategory });
  const { data: obligationsMetrics } = useObligationsMetrics({ enabled: isObligationsCategory });
  const { data: usersMetrics } = useUsersMetrics({ enabled: isUsersCategory });
  const { data: messagingMetrics } = useMessagingMetrics({ enabled: isMessagingCategory });
  const { data: hasanatMetrics } = useHasanatMetrics({ enabled: isHasanat });
  const { data: sessionsMetrics } = useSessionsMetrics({ enabled: isSessions });
  const { data: examinationsMetrics } = useExaminationsMetrics({ enabled: isExaminations });
  const { data: questionBankMetrics } = useQuestionBankMetrics({ enabled: isQuestionBank });

  const questionBankQuestions = useQuestionBankQuestionsCollection({ enabled: isQuestionBank });
  const questionBankTests = useQuestionBankTestsCollection({ enabled: isQuestionBank });
  const questionBankResults = useQuestionBankResultsCollection({ enabled: isQuestionBank });

  const contactAnalytics = contactsReportData?.analytics;
  const auxiliaryStudentMetrics = category === "enrollments" ? studentMetrics : crossStudentMetrics;
  const auxiliaryFacultyMetrics = category === "enrollments" ? facultyMetrics : crossFacultyMetrics;

  return {
    contactAnalytics,
    studentMetrics,
    facultyMetrics,
    auxiliaryStudentMetrics,
    auxiliaryFacultyMetrics,
    attendanceMetrics,
    financeMetrics,
    accountingMetrics,
    obligationsMetrics,
    usersMetrics,
    messagingMetrics,
    hasanatMetrics,
    sessionsMetrics,
    examinationsMetrics,
    questionBankMetrics,
    questionBankQuestions,
    questionBankTests,
    questionBankResults,
  };
}
