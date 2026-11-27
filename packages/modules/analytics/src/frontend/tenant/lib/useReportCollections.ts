import {
  type Contact,
  type Enrollment,
  type QuestionBankQuestion,
  type QuestionBankResult,
  type QuestionBankTest,
  type FacultyMember,
  FINANCE_MODULE_MANIFEST,
} from "@mms/contracts";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { usePermissions } from "../host/usePermissions";
import type { AttendanceRecord } from "@mms/contracts";
import type { Invoice } from "@mms/contracts";
import type { Denomination, Distribution } from "@mms/contracts";
import type { Session } from "@mms/contracts";
import type { Student } from "@mms/contracts";
import { useAttendanceRecordsCollection } from "../host/collections";
import { useFinanceInvoicesPaginated } from "../host/collections";
import { useHasanatDenomsCollection, useHasanatDistributionsCollection } from "../host/collections";
import {
  useQuestionBankQuestionsCollection,
  useQuestionBankResultsCollection,
  useQuestionBankTestsCollection,
} from "../host/collections";
import type { ReportCollection } from "./reportMetadata";

export type ReportCollectionsSnapshot = {
  students: Student[];
  faculty: FacultyMember[];
  sessions: Session[];
  enrollments: Enrollment[];
  finance_invoices: Invoice[];
  attendance_records: AttendanceRecord[];
  hasanat_distributions: Distribution[];
  hasanat_denoms: Denomination[];
  contacts: Contact[];
  questions: QuestionBankQuestion[];
  tests: QuestionBankTest[];
  assessment_results: QuestionBankResult[];
};

/**
 * Live Query-backed collections for dashboard widgets / report builders.
 * Prefer this over sync `getWidgetCollections()` + localStorage.
 * Pass `requiredCollections` to fetch only the collections pinned widgets need.
 */
export function useWidgetCollections(options?: {
  enabled?: boolean;
  requiredCollections?: ReadonlySet<ReportCollection> | readonly ReportCollection[];
}): ReportCollectionsSnapshot {
  const enabled = options?.enabled ?? true;
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const canReadHasanat = can("hasanat.read");
  const queryEnabled = isAuthenticated && enabled;
  const required = options?.requiredCollections ? new Set(options.requiredCollections) : null;
  const needs = (collection: ReportCollection): boolean =>
    queryEnabled && (required === null || required.has(collection));

  // Contacts + students + faculty + sessions + enrollments widgets/charts read SQL aggregates — do not page-walk entities here.
  const contacts: Contact[] = [];
  const students: Student[] = [];
  const faculty: FacultyMember[] = [];
  const sessions: Session[] = [];
  const enrollments: Enrollment[] = [];
  const financeInvoices =
    useFinanceInvoicesPaginated(
      { page: 1, limit: FINANCE_MODULE_MANIFEST.maxPageSize },
      { enabled: needs("finance_invoices") },
    ).data?.invoices ?? [];
  const attendanceRecords = useAttendanceRecordsCollection({
    enabled: needs("attendance_records"),
  });
  const hasanatDistributions = useHasanatDistributionsCollection({
    enabled: needs("hasanat_distributions") && canReadHasanat,
  });
  const hasanatDenoms = useHasanatDenomsCollection({
    enabled: needs("hasanat_distributions") && canReadHasanat,
  });
  const questions = useQuestionBankQuestionsCollection({ enabled: needs("questions") });
  const tests = useQuestionBankTestsCollection({ enabled: needs("tests") });
  const assessmentResults = useQuestionBankResultsCollection({
    enabled: needs("assessment_results"),
  });

  return {
    students,
    faculty,
    sessions,
    enrollments,
    finance_invoices: financeInvoices,
    attendance_records: attendanceRecords,
    hasanat_distributions: hasanatDistributions,
    hasanat_denoms: hasanatDenoms,
    contacts,
    questions,
    tests,
    assessment_results: assessmentResults,
  };
}

/**
 * Query-backed rows for a single report collection key (chart visualizer).
 * Only the active collection (+ hasanat denoms when needed) is fetched.
 */
export function useReportCollectionRows(collectionKey: ReportCollection | string): {
  rows: Record<string, unknown>[];
  denominations: Denomination[];
} {
  const { isAuthenticated } = useAuth();
  const key = collectionKey;

  const financeInvoices =
    useFinanceInvoicesPaginated(
      { page: 1, limit: FINANCE_MODULE_MANIFEST.maxPageSize },
      { enabled: isAuthenticated && key === "finance_invoices" },
    ).data?.invoices ?? [];
  const attendanceRecords = useAttendanceRecordsCollection({
    enabled: isAuthenticated && key === "attendance_records",
  });
  const hasanatDistributions = useHasanatDistributionsCollection({
    enabled: isAuthenticated && key === "hasanat_distributions",
  });
  const hasanatDenoms = useHasanatDenomsCollection({
    enabled: isAuthenticated && key === "hasanat_distributions",
  });
  const questions = useQuestionBankQuestionsCollection({
    enabled: isAuthenticated && key === "questions",
  });
  const tests = useQuestionBankTestsCollection({ enabled: isAuthenticated && key === "tests" });
  const assessmentResults = useQuestionBankResultsCollection({
    enabled: isAuthenticated && key === "assessment_results",
  });

  let rows: Record<string, unknown>[] = [];
  switch (key) {
    case "finance_invoices":
      rows = financeInvoices.map((inv: any) => ({ ...inv }));
      break;
    case "attendance_records":
      rows = attendanceRecords.map((att: any) => ({ ...att }));
      break;
    case "hasanat_distributions":
      rows = hasanatDistributions.map((dist: any) => ({ ...dist }));
      break;
    case "questions":
      rows = questions.map((q: any) => ({ ...q }));
      break;
    case "tests":
      rows = tests.map((t: any) => ({ ...t }));
      break;
    case "assessment_results":
      rows = assessmentResults.map((res: any) => ({ ...res }));
      break;
    default:
      rows = [];
  }

  return { rows, denominations: hasanatDenoms };
}
