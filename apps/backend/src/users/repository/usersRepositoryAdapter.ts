import type { UsersRepository } from "./usersRepository.js";
import {
  softDeleteTenantUserRow,
  restoreTenantUserRow,
  verifyTenantUserEmailRow,
  resetTenantUserPasswordRow,
  findTenantUserRowById,
  listTenantUsersByIds,
} from "../../db/repositories/tenantUserRepository.js";
import {
  aggregateUsersCommandMetrics,
  countTenantUsersActive,
  listTenantUsersPage,
} from "../../db/repositories/tenantUserRepositoryList.js";
import {
  listActivityLogsByWorkspace,
  findActivityLogById,
  findActivityLogsByIds,
  saveActivityLog,
  bulkSaveActivityLogs,
  replaceActivityLogsForWorkspace,
} from "../../db/repositories/logsRepository.js";

/**
 * Drizzle-backed adapter for {@link UsersRepository}. Delegates to the existing
 * concrete repository functions (no SQL rewrite in this pass).
 */
export const usersRepository: UsersRepository = {
  listTenantUsersPage,
  countTenantUsersActive,
  aggregateUsersCommandMetrics,
  listTenantUsersByIds,
  findTenantUserRowById,
  softDeleteTenantUserRow,
  restoreTenantUserRow,
  verifyTenantUserEmailRow,
  resetTenantUserPasswordRow,
  listActivityLogsByWorkspace,
  findActivityLogById,
  findActivityLogsByIds,
  saveActivityLog,
  bulkSaveActivityLogs,
  replaceActivityLogsForWorkspace,
};
