import * as activityLogs from "./db/platformActivityLogsRepository.js";
import * as platformUsers from "./db/platformUserRepository.js";
import * as tenantUsers from "../deps.js";
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
  insertPlatformActivityLog: (...args: any[]) =>
    (activityLogs.insertPlatformActivityLog as any)(...args),
  listPlatformActivityLogs: (...args: any[]) =>
    (activityLogs.listPlatformActivityLogs as any)(...args),
  listPlatformUsers: (...args: any[]) => (platformUsers.listPlatformUsers as any)(...args),
  verifyTenantUserEmailRow: (...args: any[]) =>
    (tenantUsers.verifyTenantUserEmailRow as any)(...args),
  findTenantUserRowById: (...args: any[]) => (tenantUsers.findTenantUserRowById as any)(...args),
};
