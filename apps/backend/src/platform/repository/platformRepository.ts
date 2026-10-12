/**
 * @file platformRepository.ts
 * @description Storage contract for the platform (apex) console.
 *
 * Use-cases depend on this interface — never on the concrete Drizzle functions in
 * `db/repositories/*`. The Drizzle-backed adapter is the only implementation.
 */
type ActivityLogsModule = typeof import("../../db/repositories/platformActivityLogsRepository.js");
type PlatformUserModule = typeof import("../../db/repositories/platformUserRepository.js");
type TenantUserModule = typeof import("../../db/repositories/tenantUserRepository.js");

export interface PlatformRepository {
  insertPlatformActivityLog: ActivityLogsModule["insertPlatformActivityLog"];
  listPlatformActivityLogs: ActivityLogsModule["listPlatformActivityLogs"];
  listPlatformUsers: PlatformUserModule["listPlatformUsers"];
  verifyTenantUserEmailRow: TenantUserModule["verifyTenantUserEmailRow"];
  findTenantUserRowById: TenantUserModule["findTenantUserRowById"];
}
