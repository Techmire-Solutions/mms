import * as activityLogs from "../../db/repositories/platformActivityLogsRepository.js";
import * as platformUsers from "../../db/repositories/platformUserRepository.js";
import * as tenantUsers from "../../db/repositories/tenantUserRepository.js";
import type { PlatformRepository } from "./platformRepository.js";

/**
 * Drizzle-backed implementation of {@link PlatformRepository}. The only file in the
 * platform domain that binds to the concrete storage functions.
 *
 * The members delegate through a namespace import and resolve the target at **call
 * time** rather than destructuring at module load. Platform route suites mock these
 * repositories with partial factories while still loading the routes via `buildApp()`,
 * so an eager object literal would evaluate every binding up front and throw on a
 * missing export the route never actually calls.
 */
export const platformRepositoryAdapter: PlatformRepository = {
  insertPlatformActivityLog: (...args) => activityLogs.insertPlatformActivityLog(...args),
  listPlatformActivityLogs: (...args) => activityLogs.listPlatformActivityLogs(...args),
  listPlatformUsers: (...args) => platformUsers.listPlatformUsers(...args),
  verifyTenantUserEmailRow: (...args) => tenantUsers.verifyTenantUserEmailRow(...args),
  findTenantUserRowById: (...args) => tenantUsers.findTenantUserRowById(...args),
};
