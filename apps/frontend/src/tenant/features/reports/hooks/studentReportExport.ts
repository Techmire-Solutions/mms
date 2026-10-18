import {
  ENROLLMENTS_MODULE_MANIFEST,
  formatDate,
  type Enrollment,
  type Session,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { fetchAllStudentsForQuery } from "@/tenant/hooks/collections/students";
import { mapStudentRow, type EnrollmentHistoryItem } from "@/components/reports/studentReportTypes";

/** Page-walk enrollments for report export (avoids maxPageSize collection dump in the UI). */
export async function fetchAllEnrollmentsForQuery(params: {
  search?: string;
  sessionId?: string;
}): Promise<Enrollment[]> {
  const limit = ENROLLMENTS_MODULE_MANIFEST.maxPageSize;
  const all: Enrollment[] = [];
  let page = 1;
  for (;;) {
    const res = await apiContract.enrollments.list({
      query: {
        page,
        limit,
        search: params.search?.trim(),
        sessionId:
          params.sessionId?.trim() && params.sessionId !== "all"
            ? params.sessionId.trim()
            : undefined,
      },
    });
    const result = res.body as { enrollments?: Enrollment[]; hasMore?: boolean };
    all.push(...(result.enrollments ?? []));
    if (!result.hasMore) break;
    if (page >= 200) {
      throw new Error(
        "Enrollment export exceeds the 100,000-record safety limit; narrow the filters.",
      );
    }
    page += 1;
  }
  return all;
}

/** Maps an Enrollment row to the report history table shape. */
export function mapEnrollmentRow(enrollment: Enrollment): EnrollmentHistoryItem {
  return {
    id: enrollment.id,
    studentName: enrollment.studentName,
    session: enrollment.sessionName,
    class: enrollment.className || "—",
    enrolled: formatDate(enrollment.enrolledDate),
    status: enrollment.status,
  };
}

/** Resolves full student rows for CSV/Excel/PDF export (server-side filters). */
export async function resolveStudentReportExportRows(input: {
  search?: string;
  status?: string;
  sessionId?: string;
  className?: string;
  sessions: Session[];
}): Promise<Record<string, unknown>[]> {
  const { search, status, sessionId, className, sessions } = input;
  const source = await fetchAllStudentsForQuery({
    search,
    status,
    sessionId,
    className,
  });
  return source.map((student) => ({ ...mapStudentRow(student, sessions) }));
}

/** Resolves full enrollment rows for report export. */
export async function resolveEnrollmentReportExportRows(input: {
  search?: string;
  sessionId?: string;
}): Promise<Record<string, unknown>[]> {
  const all = await fetchAllEnrollmentsForQuery(input);
  return all.map((enrollment) => ({ ...mapEnrollmentRow(enrollment) }));
}
