/**
 * Boot-time platform services, injected into the kernel database initializer.
 *
 * `db/dbInit.ts` used to import these six services directly, which is the
 * `db → services` half of the kernel cycle (docs/monorepo-migration-plan.md §6.1,
 * U3): it keeps `apps/api/src/db` from ever becoming `packages/db`. The
 * orchestrator now receives them, and this module is the only place that knows
 * which concrete services exist.
 *
 * Order matters and is owned by `dbInit` (lock → DDL → data migrations →
 * partitions → purge → platform super user → tenant sync → settings → branding →
 * seed-if-empty). Each hook is optional so a script can opt out explicitly.
 */
export interface PlatformBootServices {
  /**
   * Provision rolling monthly audit partitions. Failure is non-fatal at boot
   * (writes still land in the DEFAULT partition), so `dbInit` only logs it.
   */
  ensureAuditTrailPartitions?: () => Promise<void>;
  /** Delete expired ephemeral auth artifacts (handoff/2FA/refresh/login-email-change). */
  purgeExpiredAuthArtifacts?: () => Promise<void>;
  /** Ensure the platform super user from the environment exists. */
  ensurePlatformSuperUser?: () => Promise<void>;
  /** Project the platform super user into every tenant workspace. */
  syncPlatformSuperUserToTenants?: () => Promise<void>;
  /** Seed platform settings defaults. */
  initPlatformSettings?: () => Promise<void>;
  /** Seed platform branding defaults. */
  initPlatformBranding?: () => Promise<void>;
}

/** Explicit "this script must not touch platform data" opt-out. */
export const NO_PLATFORM_BOOT_SERVICES: PlatformBootServices = Object.freeze({});

/**
 * The real platform services. This is the app-layer composition point for the
 * boot pipeline — keep it the only importer of these modules from `bootstrap/`.
 */
export function createPlatformBootServices(): PlatformBootServices {
  return {
    ensureAuditTrailPartitions: async () => {
      const { ensureAuditTrailPartitions } = await import("../services/auditPartitionService.js");
      await ensureAuditTrailPartitions();
    },
    purgeExpiredAuthArtifacts: async () => {
      const { purgeExpiredAuthArtifacts } = await import("../services/auth/authArtifactService.js");
      await purgeExpiredAuthArtifacts();
    },
    ensurePlatformSuperUser: async () => {
      const { ensurePlatformSuperUserFromEnv } =
        await import("../services/platform/platformUserService.js");
      await ensurePlatformSuperUserFromEnv();
    },
    syncPlatformSuperUserToTenants: async () => {
      const { syncPlatformSuperUserToTenants } =
        await import("../services/platform/platformSuperUserTenantSyncService.js");
      await syncPlatformSuperUserToTenants();
    },
    initPlatformSettings: async () => {
      const { initPlatformSettings } =
        await import("../services/platform/platformSettingsService.js");
      await initPlatformSettings();
    },
    initPlatformBranding: async () => {
      const { initPlatformBranding } =
        await import("../services/platform/platformBrandingService.js");
      await initPlatformBranding();
    },
  };
}
