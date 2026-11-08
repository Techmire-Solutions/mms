import type {
  Enrollment,
  EnrollmentsListQuery,
  EnrollmentsListPageResult,
  EnrollmentsCommandMetricsSnapshot,
  EnrollmentsWidgetQuery,
  EnrollmentsWidgetAggregateResult,
  EnrollmentsReportAggregates,
  EnrollmentsReportComparisonQuery,
} from "@mms/shared";

/**
 * Sole storage gateway for the enrollments module.
 *
 * Mirrors the `contacts`/`sessions` reference pattern: routes/use-cases depend on
 * this interface (never on Drizzle directly), and the Drizzle-backed adapter is
 * the only implementation. Tests can inject a fake repository at the seam.
 */
export interface EnrollmentsRepository {
  listEnrollmentsByWorkspace(tenant: string): Promise<Enrollment[]>;
  findEnrollmentById(
    tenant: string,
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<Enrollment | null>;
  findEnrollmentsByIds(
    tenant: string,
    ids: string[],
    options?: { includeDeleted?: boolean },
  ): Promise<Enrollment[]>;
  /** Live (seat-holding) enrollment of a student in a session, if any. */
  findActiveEnrollmentInSession?(
    tenant: string,
    sessionId: string,
    studentId: string,
  ): Promise<Enrollment | null>;
  saveEnrollment(tenant: string, record: Enrollment): Promise<void>;
  /** Guarded status transition for the manual CRUD channel (see enrollmentStateMachine). */
  transitionEnrollmentStatusTx?(
    tx: import("../../db/tenant-context.js").TenantTransaction,
    subdomain: string,
    input: { id: string; from: string; to: string },
  ): Promise<void>;
  listEnrollmentsPage(
    tenant: string,
    query: EnrollmentsListQuery,
  ): Promise<EnrollmentsListPageResult>;
  countEnrollmentsActive(tenant: string): Promise<number>;
  aggregateEnrollmentsCommandMetrics(tenant: string): Promise<EnrollmentsCommandMetricsSnapshot>;
  aggregateEnrollmentsWidgetQueries(
    tenant: string,
    queries: EnrollmentsWidgetQuery[],
  ): Promise<Record<string, EnrollmentsWidgetAggregateResult>>;
  loadEnrollmentsReportAggregates(
    tenant: string,
    comparisonQuery?: EnrollmentsReportComparisonQuery,
  ): Promise<EnrollmentsReportAggregates>;
  bulkSoftDeleteEnrollments?(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreEnrollments?(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  findStudentById?(
    tenant: string,
    id: string,
  ): Promise<{
    id: string;
    deletedAt?: unknown;
    dob?: string | null;
    gender?: string | null;
  } | null>;
  findSessionById?(
    tenant: string,
    id: string,
  ): Promise<{
    id: string;
    deletedAt?: unknown;
    status?: string;
    startDate?: string | null;
    classes?: Array<{
      id: string;
      name?: string;
      gender?: string | null;
      minAge?: number | null;
      maxAge?: number | null;
      ageCalculationDate?: string | null;
      enrollmentDeadline?: string;
      dropDeadline?: string;
    }>;
  } | null>;
  findWorkspaceTimezone?(tenant: string): Promise<string | null>;
}
