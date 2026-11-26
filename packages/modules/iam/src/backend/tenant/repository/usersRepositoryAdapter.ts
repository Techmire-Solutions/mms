import type { UsersRepository } from "./usersRepository.js";
import * as repo from "./index.js";
import * as deps from "../deps.js";

/**
 * Drizzle-backed adapter for {@link UsersRepository}. Delegates dynamically
 * through the repository barrel and port adapters so both concrete submodule
 * mocks and `@mms/mod-iam/backend/tenant/repository` barrel mocks intercept calls.
 */
export const usersRepository: UsersRepository = {
  listTenantUsersPage: (tenant, query) => repo.listTenantUsersPage(tenant, query),
  countTenantUsersActive: (tenant) => repo.countTenantUsersActive(tenant),
  aggregateUsersCommandMetrics: (tenant, periodDays) =>
    repo.aggregateUsersCommandMetrics(tenant, periodDays),
  listTenantUsersByIds: (tenant, ids) => repo.listTenantUsersByIds(tenant, ids),
  findTenantUserRowById: (tenant, id) => repo.findTenantUserRowById(tenant, id),
  softDeleteTenantUserRow: (tenant, id, deletedBy) =>
    repo.softDeleteTenantUserRow(tenant, id, deletedBy),
  restoreTenantUserRow: (tenant, id) => repo.restoreTenantUserRow(tenant, id),
  verifyTenantUserEmailRow: (tenant, id) => repo.verifyTenantUserEmailRow(tenant, id),
  resetTenantUserPasswordRow: (tenant, id, passwordHash) =>
    repo.resetTenantUserPasswordRow(tenant, id, passwordHash),
  listActivityLogsByWorkspace: (tenant) => deps.listActivityLogsByWorkspace(tenant),
  findActivityLogById: (tenant, id) => deps.findActivityLogById(tenant, id),
  findActivityLogsByIds: (tenant, ids) => deps.findActivityLogsByIds(tenant, ids),
  saveActivityLog: (tenant, record) => deps.saveActivityLog(tenant, record),
  bulkSaveActivityLogs: (tenant, records) => deps.bulkSaveActivityLogs(tenant, records),
  replaceActivityLogsForWorkspace: (tenant, records) =>
    deps.replaceActivityLogsForWorkspace(tenant, records),
};
