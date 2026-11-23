/**
 * Platform (apex) persistence adapter — the services layer reaches storage only
 * through this seam, keeping `services/**` free of direct repository imports
 * (SYSTEM_ARCHITECTURE.md §5). Mirrors the existing platform repository adapters.
 */
export {
  findPlatformSettingsRow,
  insertPlatformSettingsDefaultRow,
  upsertPlatformSettingsRow,
  GLOBAL_SETTINGS_ID,
} from "../../db/repositories/platformSettingsRepository.js";
export {
  findPlatformBrandingRow,
  insertPlatformBrandingDefaultRow,
  upsertPlatformBrandingRow,
  GLOBAL_BRANDING_ID,
} from "../../db/repositories/platformBrandingRepository.js";
export { listWorkspaceRows } from "../../db/repositories/workspaceRepository.js";
export { listPlatformUsers } from "../../db/repositories/platformUserQueries.js";
