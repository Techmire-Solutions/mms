/**
 * @file platformRepository.ts
 * @description Storage contract for the platform (apex) console.
 *
 * Use-cases depend on this interface — never on the concrete Drizzle functions in
 * `db/repositories/*`. The Drizzle-backed adapter is the only implementation.
 */
type ActivityLogsModule = typeof import("../repository/db/platformActivityLogsRepository.js");
type PlatformUserModule = typeof import("../repository/db/platformUserRepository.js");
type TenantUserModule = typeof import("../deps.js");

export interface PlatformRepository {
  insertPlatformActivityLog: ActivityLogsModule["insertPlatformActivityLog"];
  listPlatformActivityLogs: ActivityLogsModule["listPlatformActivityLogs"];
  listPlatformUsers: PlatformUserModule["listPlatformUsers"];
  verifyTenantUserEmailRow: TenantUserModule["verifyTenantUserEmailRow"];
  findTenantUserRowById: TenantUserModule["findTenantUserRowById"];
}
