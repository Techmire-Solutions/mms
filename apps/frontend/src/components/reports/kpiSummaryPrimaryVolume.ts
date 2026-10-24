import type { QuestionBankQuestion, QuestionBankResult, QuestionBankTest } from "@mms/shared";
import type {
  AttendanceCommandMetricsSnapshot,
  FinanceCommandMetricsSnapshot,
  HasanatCommandMetricsSnapshot,
  SessionsCommandMetricsSnapshot,
  ExaminationsCommandMetricsSnapshot,
  QuestionBankCommandMetricsSnapshot,
} from "@mms/shared";
import type { ContactKPIAnalytics, EntityKPIMetrics, FacultyKPIMetrics } from "./kpiSummaryTypes";

export interface PrimaryVolumeInputs {
  category: string;
  studentMetrics?: EntityKPIMetrics;
  facultyMetrics?: FacultyKPIMetrics;
  contactAnalytics?: ContactKPIAnalytics;
  attendanceMetrics?: AttendanceCommandMetricsSnapshot;
  financeMetrics?: FinanceCommandMetricsSnapshot;
  hasanatMetrics?: HasanatCommandMetricsSnapshot;
  sessionsMetrics?: SessionsCommandMetricsSnapshot;
  examinationsMetrics?: ExaminationsCommandMetricsSnapshot;
  questionBankMetrics?: QuestionBankCommandMetricsSnapshot;
  questionBankQuestions: QuestionBankQuestion[];
  questionBankTests: QuestionBankTest[];
  questionBankResults: QuestionBankResult[];
}

/** Resolves the primary record count shown for a report category KPI strip. */
export function computePrimaryVolume(inputs: PrimaryVolumeInputs): number {
  const {
    category,
    studentMetrics,
    facultyMetrics,
    contactAnalytics,
    attendanceMetrics,
    financeMetrics,
    hasanatMetrics,
    sessionsMetrics,
    examinationsMetrics,
    questionBankMetrics,
    questionBankQuestions,
    questionBankTests,
    questionBankResults,
  } = inputs;

  switch (category) {
    case "students":
      return studentMetrics?.total ?? 0;
    case "contacts":
      return contactAnalytics?.total ?? 0;
    case "attendance":
      return attendanceMetrics?.total ?? 0;
    case "financial":
    case "accounting":
      return financeMetrics?.totalInvoices ?? 0;
    case "hasanat":
      return hasanatMetrics?.distributed ?? 0;
    case "sessions":
      return sessionsMetrics?.total ?? 0;
    case "examinations":
      return (examinationsMetrics?.totalResults ?? 0) + (examinationsMetrics?.total ?? 0);
    case "questionBank":
      return (
        (questionBankMetrics?.total ?? questionBankQuestions.length) +
        (questionBankMetrics?.totalTests ?? questionBankTests.length) +
        (questionBankMetrics?.totalResults ?? questionBankResults.length)
      );
    case "enrollments":
      return (studentMetrics?.total ?? 0) + (sessionsMetrics?.total ?? 0);
    case "faculty":
      return facultyMetrics?.total ?? 0;
    default:
      return 0;
  }
}
