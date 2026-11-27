import { getAnalyticsHost } from "../host.js";

function collection(name: string): any {
  return (getAnalyticsHost() as any).collections?.[name] ?? {};
}

export const useAccountingMetrics = (...a: any[]) =>
  collection("accounting").useAccountingMetrics?.(...a);
export const useAttendanceMetrics = (...a: any[]) =>
  collection("attendance").useAttendanceMetrics?.(...a);
export const useAttendanceRecords = (...a: any[]) =>
  collection("attendance").useAttendanceRecords?.(...a);
export const useAttendanceRecordsCollection = (...a: any[]) =>
  collection("attendance").useAttendanceRecordsCollection?.(...a);
export const useAttendanceReportAggregates = (...a: any[]) =>
  collection("attendance").useAttendanceReportAggregates?.(...a);
export const useContactsContractList = (...a: any[]) =>
  collection("contacts").useContactsContractList?.(...a);
export const useContactsReportAnalytics = (...a: any[]) =>
  collection("contacts").useContactsReportAnalytics?.(...a);
export const useContactsSavedReportsSource = (...a: any[]) =>
  collection("contacts").useContactsSavedReportsSource?.(...a);
export const useContactsWidgetAggregates = (...a: any[]) =>
  collection("contacts").useContactsWidgetAggregates?.(...a);
export const useEnrollmentsPaginated = (...a: any[]) =>
  collection("enrollments").useEnrollmentsPaginated?.(...a);
export const useEnrollmentsReportAggregates = (...a: any[]) =>
  collection("enrollments").useEnrollmentsReportAggregates?.(...a);
export const useEnrollmentsWidgetAggregates = (...a: any[]) =>
  collection("enrollments").useEnrollmentsWidgetAggregates?.(...a);
export const useExaminationsExams = (...a: any[]) =>
  collection("examinations").useExaminationsExams?.(...a);
export const useExaminationsExamsCollection = (...a: any[]) =>
  collection("examinations").useExaminationsExamsCollection?.(...a);
export const useExaminationsMetrics = (...a: any[]) =>
  collection("examinations").useExaminationsMetrics?.(...a);
export const useExaminationsReportAggregates = (...a: any[]) =>
  collection("examinations").useExaminationsReportAggregates?.(...a);
export const useExaminationsResults = (...a: any[]) =>
  collection("examinations").useExaminationsResults?.(...a);
export const useExaminationsResultsCollection = (...a: any[]) =>
  collection("examinations").useExaminationsResultsCollection?.(...a);
export const applyFacultyWorkDrillDown = (...a: any[]) =>
  collection("faculty").applyFacultyWorkDrillDown?.(...a);
export const fetchAllFacultyForQuery = (...a: any[]) =>
  collection("faculty").fetchAllFacultyForQuery?.(...a);
export const useFacultyByIds = (...a: any[]) => collection("faculty").useFacultyByIds?.(...a);
export const useFacultyContractList = (...a: any[]) =>
  collection("faculty").useFacultyContractList?.(...a);
export const useFacultyMetrics = (...a: any[]) => collection("faculty").useFacultyMetrics?.(...a);
export const useFacultyWidgetAggregates = (...a: any[]) =>
  collection("faculty").useFacultyWidgetAggregates?.(...a);
export const useFinanceInvoicesPaginated = (...a: any[]) =>
  collection("finance").useFinanceInvoicesPaginated?.(...a);
export const useFinanceMetrics = (...a: any[]) => collection("finance").useFinanceMetrics?.(...a);
export const useFinanceReportAggregates = (...a: any[]) =>
  collection("finance").useFinanceReportAggregates?.(...a);
export const useHasanatDistributionsCollection = (...a: any[]) =>
  collection("hasanat").useHasanatDistributionsCollection?.(...a);
export const useHasanatMetrics = (...a: any[]) => collection("hasanat").useHasanatMetrics?.(...a);
export const useHasanatReportAggregates = (...a: any[]) =>
  collection("hasanat").useHasanatReportAggregates?.(...a);
export const useHasanatStudentReport = (...a: any[]) =>
  collection("hasanat").useHasanatStudentReport?.(...a);
export const MESSAGING_CHANNEL_CONFIG: Record<string, any> = new Proxy(
  {},
  {
    get: (_t: any, k: any) => collection("messaging").MESSAGING_CHANNEL_CONFIG?.[k as string],
  },
);
export type MessagingChannelConfig = any;
export const exportMessagingLogsFiltered = (...a: any[]) =>
  collection("messaging").exportMessagingLogsFiltered?.(...a);
export const messagingExportEndDateBound = (...a: any[]) =>
  collection("messaging").messagingExportEndDateBound?.(...a);
export const useMessagingMetrics = (...a: any[]) =>
  collection("messaging").useMessagingMetrics?.(...a);
export const useObligationsMetrics = (...a: any[]) =>
  collection("obligations").useObligationsMetrics?.(...a);
export const useQuestionBankConfig = (...a: any[]) =>
  collection("questionBank").useQuestionBankConfig?.(...a);
export const useQuestionBankMetrics = (...a: any[]) =>
  collection("questionBank").useQuestionBankMetrics?.(...a);
export const useQuestionBankQuestions = (...a: any[]) =>
  collection("questionBank").useQuestionBankQuestions?.(...a);
export const useQuestionBankQuestionsCollection = (...a: any[]) =>
  collection("questionBank").useQuestionBankQuestionsCollection?.(...a);
export const useQuestionBankReportAggregates = (...a: any[]) =>
  collection("questionBank").useQuestionBankReportAggregates?.(...a);
export const useQuestionBankResults = (...a: any[]) =>
  collection("questionBank").useQuestionBankResults?.(...a);
export const useQuestionBankResultsCollection = (...a: any[]) =>
  collection("questionBank").useQuestionBankResultsCollection?.(...a);
export const useQuestionBankTests = (...a: any[]) =>
  collection("questionBank").useQuestionBankTests?.(...a);
export const useQuestionBankTestsCollection = (...a: any[]) =>
  collection("questionBank").useQuestionBankTestsCollection?.(...a);
export const useSessions = (...a: any[]) => collection("sessions").useSessions?.(...a);
export const useSessionsCollection = (...a: any[]) =>
  collection("sessions").useSessionsCollection?.(...a);
export const useSessionsMetrics = (...a: any[]) =>
  collection("sessions").useSessionsMetrics?.(...a);
export const useSessionsReportAggregates = (...a: any[]) =>
  collection("sessions").useSessionsReportAggregates?.(...a);
export const useSessionsWidgetAggregates = (...a: any[]) =>
  collection("sessions").useSessionsWidgetAggregates?.(...a);
export const fetchAllStudentsForQuery = (...a: any[]) =>
  collection("students").fetchAllStudentsForQuery?.(...a);
export const useStudentsByIds = (...a: any[]) => collection("students").useStudentsByIds?.(...a);
export const useStudentsContractList = (...a: any[]) =>
  collection("students").useStudentsContractList?.(...a);
export const useStudentsMetrics = (...a: any[]) =>
  collection("students").useStudentsMetrics?.(...a);
export const useStudentsWidgetAggregates = (...a: any[]) =>
  collection("students").useStudentsWidgetAggregates?.(...a);
export const useActivityLogs = (...a: any[]) => collection("users").useActivityLogs?.(...a);
export const useUsersByIds = (...a: any[]) => collection("users").useUsersByIds?.(...a);
export const useUsersMetrics = (...a: any[]) => collection("users").useUsersMetrics?.(...a);
export const useUsersPaginated = (...a: any[]) => collection("users").useUsersPaginated?.(...a);

// Host stubs for symbols bound at composition time.
export const ATTENDANCE_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const CONTACTS_METRICS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const CONTACTS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const CONTACTS_WIDGET_AGGREGATES_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const ENROLLMENTS_METRICS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const FACULTY_METRICS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const FACULTY_WIDGET_AGGREGATES_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const FINANCE_INVOICES_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const HASANAT_DENOMS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const HASANAT_DISTRIBUTIONS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const HASANAT_METRICS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const HASANAT_REPORT_AGGREGATES_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const QUESTION_BANK_QUESTIONS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const QUESTION_BANK_RESULTS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const QUESTION_BANK_TESTS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const SESSIONS_METRICS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const SESSIONS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const SESSIONS_WIDGET_AGGREGATES_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const STUDENTS_METRICS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const STUDENTS_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export const STUDENTS_WIDGET_AGGREGATES_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: () => undefined,
}) as unknown as readonly unknown[];
export function useHasanatDenomsCollection(...a: any[]): any {
  return (getAnalyticsHost() as any).collections?.useHasanatDenomsCollection?.(...a);
}
