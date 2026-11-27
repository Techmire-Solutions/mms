import { readQueryCollection } from "../host/reportLibs";
import { ATTENDANCE_QUERY_KEY } from "../host/collections";
import { FINANCE_INVOICES_QUERY_KEY } from "../host/collections";
import { HASANAT_DENOMS_QUERY_KEY, HASANAT_DISTRIBUTIONS_QUERY_KEY } from "../host/collections";
import {
  QUESTION_BANK_QUESTIONS_QUERY_KEY,
  QUESTION_BANK_RESULTS_QUERY_KEY,
  QUESTION_BANK_TESTS_QUERY_KEY,
} from "../host/collections";
import type { CustomWidget } from "./pinnedWidgetTypes";
import type { ReportCollectionsSnapshot } from "./useReportCollections";
import type { Denomination, Distribution } from "@mms/contracts";
import type { Student } from "@mms/contracts";
import type { Session } from "@mms/contracts";
import type { Invoice } from "@mms/contracts";
import type { AttendanceRecord } from "@mms/contracts";
import {
  matchesWidgetFilter,
  type Contact,
  type Enrollment,
  type FacultyMember,
  type QuestionBankQuestion,
  type QuestionBankResult,
  type QuestionBankTest,
} from "@mms/contracts";

export function getWidgetCollections(): ReportCollectionsSnapshot {
  // Contacts + students + faculty + sessions + enrollments: SQL aggregates / empty dump — do not invent localStorage rows.
  const contacts: Contact[] = [];
  const students: Student[] = [];
  const faculty: FacultyMember[] = [];
  const sessions: Session[] = [];
  const enrollments: Enrollment[] = [];
  const invoices = readQueryCollection<Invoice>(FINANCE_INVOICES_QUERY_KEY) ?? [];
  const attendance = readQueryCollection<AttendanceRecord>(ATTENDANCE_QUERY_KEY) ?? [];
  const distributions = readQueryCollection<Distribution>(HASANAT_DISTRIBUTIONS_QUERY_KEY) ?? [];
  const denominations = readQueryCollection<Denomination>(HASANAT_DENOMS_QUERY_KEY) ?? [];
  const questions =
    readQueryCollection<QuestionBankQuestion>(QUESTION_BANK_QUESTIONS_QUERY_KEY) ?? [];
  const tests = readQueryCollection<QuestionBankTest>(QUESTION_BANK_TESTS_QUERY_KEY) ?? [];
  const assessmentResults =
    readQueryCollection<QuestionBankResult>(QUESTION_BANK_RESULTS_QUERY_KEY) ?? [];

  return {
    students,
    faculty,
    sessions,
    enrollments,
    finance_invoices: invoices,
    attendance_records: attendance,
    hasanat_distributions: distributions,
    hasanat_denoms: denominations,
    contacts,
    questions,
    tests,
    assessment_results: assessmentResults,
  };
}

/**
 * Filters a collection in real-time based on widget query conditions.
 */
export function getFilteredRecords(
  widget: CustomWidget,
  collections: ReportCollectionsSnapshot,
): Record<string, unknown>[] {
  const collectionRecords = (collections[widget.collection] || []) as Record<string, unknown>[];
  return collectionRecords.filter((collectionRecord: any) =>
    matchesWidgetFilter(
      collectionRecord,
      widget.filterField,
      widget.filterOperator,
      widget.filterValue,
    ),
  );
}
