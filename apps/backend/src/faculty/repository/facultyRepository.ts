import type {
  Faculty,
  FacultyDuplicateCheckInput,
  FacultyDuplicateReason,
  FacultyRecord,
  FacultyCommandMetricsSnapshot,
  FacultyListPageResult,
  FacultyListQuery,
  FacultyWidgetAggregateResult,
  FacultyWidgetQuery,
} from "@mms/shared";
import type { TenantTransaction } from "../../db/tenant-context.js";

/**
 * Sole gateway to faculty storage.
 *
 * Use cases depend on this interface — never on concrete Drizzle functions —
 * so persistence can be swapped (tests, future data source) without touching
 * domain orchestration. The Drizzle implementation lives in
 * `facultyRepositoryAdapter.ts` and reuses the existing tenant-scoped
 * `db/repositories/facultyRepository*` functions.
 */
export interface FacultyRepository {
  countByWorkspace(tenant: string, options?: { includeDeleted?: boolean }): Promise<number>;
  listPage(tenant: string, query: FacultyListQuery): Promise<FacultyListPageResult>;
  findById(tenant: string, id: string): Promise<Faculty | null>;
  findByIds(tenant: string, ids: string[]): Promise<Faculty[]>;
  /** Soft-delete probe for restore-on-create re-registration (Contact SSOT). */
  findSoftDeletedByContactId(tenant: string, contactId: string): Promise<Faculty | null>;
  save(
    tenant: string,
    member: Faculty | FacultyRecord,
    options?: { createOnly?: boolean },
  ): Promise<void>;
  guardAssignmentDependents(tenant: string, ids: string[]): Promise<void>;
  bulkSave(tenant: string, members: Array<Faculty | FacultyRecord>): Promise<void>;
  aggregateCommandMetrics(
    tenant: string,
    periodDays?: number,
  ): Promise<FacultyCommandMetricsSnapshot>;
  aggregateWidgetQueries(
    tenant: string,
    queries: FacultyWidgetQuery[],
  ): Promise<Record<string, FacultyWidgetAggregateResult>>;
  listLinkedContactIds(tenant: string, excludeFacultyId?: string): Promise<Array<string | number>>;

  countNextEmployeeId(
    tenant: string,
    options?: { prefix?: string; restartAnnually?: boolean; year?: number },
  ): Promise<number>;
  /** Active rows missing an employee id (backfill candidates). */
  listActiveMissingEmployeeId(tenant: string): Promise<Faculty[]>;
  /** Active duplicate probe (contact / employeeId) before save — server authoritative. */
  findRegistrationConflict(
    tenant: string,
    input: FacultyDuplicateCheckInput,
  ): Promise<FacultyDuplicateReason | null>;
  bulkUpdateStatusSql(tenant: string, ids: string[], status: string): Promise<number>;
  bulkUpdateSpecializationSql(
    tenant: string,
    ids: string[],
    specialization: string,
  ): Promise<number>;
  countSubordinates(tenant: string, supervisorId: string): Promise<number>;
  countSubordinatesBatch(tenant: string, supervisorIds: string[]): Promise<Record<string, number>>;
  findSubordinates(tenant: string, supervisorId: string): Promise<Faculty[]>;
  reassignSubordinates(
    tenant: string,
    oldSupervisorId: string,
    newSupervisorId: string | null,
    txClient?: TenantTransaction,
  ): Promise<number>;
  findAncestorChain(tenant: string, facultyId: string, maxDepth?: number): Promise<string[]>;
}
