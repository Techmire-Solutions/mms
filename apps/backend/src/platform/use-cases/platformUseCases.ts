import type { PlatformRepository } from "../repository/platformRepository.js";
import { platformRepositoryAdapter } from "../repository/platformRepositoryAdapter.js";

/**
 * Composition root for the platform (apex) console. `repo` is injectable so tests can
 * supply a fake repository; production uses the adapter default.
 */
export function createPlatformUseCases(
  repo: PlatformRepository = platformRepositoryAdapter,
): PlatformRepository {
  return {
    insertPlatformActivityLog: repo.insertPlatformActivityLog,
    listPlatformActivityLogs: repo.listPlatformActivityLogs,
    listPlatformUsers: repo.listPlatformUsers,
    verifyTenantUserEmailRow: repo.verifyTenantUserEmailRow,
    findTenantUserRowById: repo.findTenantUserRowById,
  };
}

export const platformUseCases = createPlatformUseCases();

// Named exports let route handlers import the use-case surface directly.
export const {
  insertPlatformActivityLog,
  listPlatformActivityLogs,
  listPlatformUsers,
  verifyTenantUserEmailRow,
  findTenantUserRowById,
} = platformUseCases;
