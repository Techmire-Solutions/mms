import type {
  Student,
  StudentDuplicateCheckInput,
  StudentDuplicateReason,
  StudentRecord,
  StudentsCommandMetricsSnapshot,
  StudentsListPageResult,
  StudentsListQuery,
  StudentsWidgetAggregateResult,
  StudentsWidgetQuery,
  RepositoryListOptions,
  StudentGrNumberSettings,
} from "@mms/shared";

export type ListStudentsOptions = RepositoryListOptions;

/** GR sequence count + conflict probe inputs mirror the typed Drizzle queries. */
interface StudentGrSequenceInput {
  regDate: string;
  restartAnnually: boolean;
}

/**
 * Sole gateway to student storage.
 *
 * Use cases depend on this interface — never on concrete Drizzle functions —
 * so persistence can be swapped (tests, future data source) without touching
 * domain orchestration. The Drizzle implementation lives in
 * `studentsRepositoryAdapter.ts` and reuses the existing tenant-scoped
 * `db/repositories/studentRepository*` functions.
 */
export interface StudentsRepository {
  countByWorkspace(tenant: string, options?: ListStudentsOptions): Promise<number>;
  listPage(
    tenant: string,
    query: StudentsListQuery & { afterId?: string; skipCount?: boolean },
  ): Promise<StudentsListPageResult & { nextCursor?: string }>;
  findById(
    tenant: string,
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<Student | null>;
  findByIds(
    tenant: string,
    ids: string[],
    options?: { includeDeleted?: boolean },
  ): Promise<Student[]>;
  resolveByIdentifiers?(
    tenant: string,
    identifiers: string[],
    options?: { includeDeleted?: boolean },
  ): Promise<Student[]>;
  save(tenant: string, student: Student | StudentRecord): Promise<void>;
  bulkSave(tenant: string, students: Array<Student | StudentRecord>): Promise<void>;
  aggregateCommandMetrics(
    tenant: string,
    periodDays?: number,
  ): Promise<StudentsCommandMetricsSnapshot>;
  aggregateWidgetQueries(
    tenant: string,
    queries: StudentsWidgetQuery[],
  ): Promise<Record<string, StudentsWidgetAggregateResult>>;
  listLinkedContactIds(tenant: string, excludeStudentId?: string): Promise<Array<string | number>>;

  countNextGrNumber(tenant: string, input: StudentGrSequenceInput): Promise<number>;
  previewNextGrNumber?(
    tenant: string,
    input: { regDate: string; settings: StudentGrNumberSettings },
  ): Promise<string>;
  generateNextGrNumber?(
    tenant: string,
    input: { regDate: string; settings: StudentGrNumberSettings },
  ): Promise<string>;
  generateNextGrNumberBatch?(
    tenant: string,
    count: number,
    input: { regDate: string; settings: StudentGrNumberSettings },
  ): Promise<string[]>;
  findRegistrationConflict(
    tenant: string,
    input: StudentDuplicateCheckInput,
  ): Promise<StudentDuplicateReason | null>;
  /** Active GR → student id map for bulk-restore conflict checks. */
  findActiveGrNumberOwners(tenant: string, grNumbers: string[]): Promise<Map<string, string>>;
  /** Active Student ID → student id map for bulk-restore conflict checks. */
  findActiveStudentIdOwners(tenant: string, studentIds: string[]): Promise<Map<string, string>>;
  /** Soft-deleted student sharing `contactId` (restore-on-create probe). */
  findSoftDeletedByContactId(tenant: string, contactId: string): Promise<Student | null>;
  listActiveMissingGrNumber(tenant: string, options?: { limit?: number }): Promise<Student[]>;
  bulkUpdateStatusSql(tenant: string, ids: string[], status: string): Promise<number>;
  bulkSoftDelete?(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestore?(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  guardDeleteDependents?(tenant: string, ids: string[]): Promise<void>;
}
