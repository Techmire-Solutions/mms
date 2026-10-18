import type { ActivityLog, UsersListQuery, UsersCommandMetricsSnapshot } from "@mms/shared";
import type { TenantUserRow } from "../../db/repositories/tenantUserRepository.js";

/**
 * Sole storage gateway for the users module (tenant users + activity logs).
 *
 * Mirrors the `contacts`/`sessions`/`enrollments`/`finance`/`attendance`/`hasanat`/
 * `questionBank`/`examinations`/`obligations`/`accounting`/`messaging` reference
 * pattern: routes and use-cases depend on this interface (never on Drizzle
 * directly), and the Drizzle-backed adapter is the only implementation. Tests
 * can inject a fake repository at the seam.
 */
export interface UsersRepository {
  // Tenant users
  listTenantUsersPage(
    tenant: string,
    query: UsersListQuery & { includeDeleted?: boolean },
  ): Promise<{
    rows: TenantUserRow[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>;
  countTenantUsersActive(tenant: string): Promise<number>;
  aggregateUsersCommandMetrics(
    tenant: string,
    periodDays?: number,
  ): Promise<UsersCommandMetricsSnapshot>;
  /**
   * Tenant-scoped lookups. The workspace is the first argument and is
   * mandatory — `tenant_users` rows are isolated by RLS, and an id-only read
   * runs with RLS bypassed, so it must never be used from a tenant route.
   */
  listTenantUsersByIds(tenant: string, ids: string[]): Promise<TenantUserRow[]>;
  findTenantUserRowById(tenant: string, id: string): Promise<TenantUserRow | null>;
  softDeleteTenantUserRow(tenant: string, id: string, deletedBy: string): Promise<boolean>;
  restoreTenantUserRow(tenant: string, id: string): Promise<boolean>;
  verifyTenantUserEmailRow(tenant: string, id: string): Promise<boolean>;
  resetTenantUserPasswordRow(tenant: string, id: string, passwordHash: string): Promise<boolean>;

  // Activity logs
  listActivityLogsByWorkspace(tenant: string): Promise<ActivityLog[]>;
  findActivityLogById(tenant: string, id: string): Promise<ActivityLog | null>;
  findActivityLogsByIds(tenant: string, ids: string[]): Promise<ActivityLog[]>;
  saveActivityLog(tenant: string, record: ActivityLog): Promise<void>;
  bulkSaveActivityLogs(tenant: string, records: ActivityLog[]): Promise<void>;
  replaceActivityLogsForWorkspace(tenant: string, records: ActivityLog[]): Promise<void>;
}
