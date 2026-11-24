import {
  PLATFORM_CONFIG_BACKUP_FORMAT,
  PLATFORM_CONFIG_BACKUP_VERSION,
  decryptPlatformBackup,
  encryptPlatformBackup,
  mergePlatformBranding,
  mergePlatformSettings,
  platformConfigBackupSnapshotSchema,
  type PlatformBrandingSettings,
  type PlatformConfigBackupApplyResult,
  type PlatformConfigBackupSnapshot,
  type PlatformSettings,
} from "@mms/contracts";
import { runInGlobalTransaction } from "@mms/db/client";
import {
  upsertPlatformBrandingRow,
  GLOBAL_BRANDING_ID,
  upsertPlatformSettingsRow,
  GLOBAL_SETTINGS_ID,
  listWorkspaceRows,
  listPlatformUsers,
} from "../../platform/repository/platformSettingsAdapter.js";
import { redisSet } from "../../lib/redis.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import {
  getPlatformBranding,
  REDIS_PLATFORM_BRANDING_KEY,
  setPlatformBrandingCache,
} from "./platformBrandingService.js";
import {
  getPlatformSettings,
  REDIS_PLATFORM_SETTINGS_KEY,
  setPlatformSettingsCache,
} from "./platformSettingsService.js";

/** Non-secret settings projection captured in a configuration backup. */
function backupSettingsProjection(settings: PlatformSettings): Record<string, unknown> {
  return {
    syncTlsOnCreate: settings.syncTlsOnCreate,
    tlsExtraSans: settings.tlsExtraSans,
    certbotEmail: settings.certbotEmail,
    emailNotifications: settings.emailNotifications,
    smsNotifications: settings.smsNotifications,
    whatsAppNotifications: settings.whatsAppNotifications,
    timezone: settings.timezone,
    dateFormat: settings.dateFormat,
    themeMode: settings.themeMode,
    defaultEnabledModules: settings.defaultEnabledModules,
    disabledModules: settings.disabledModules,
    idleSessionMinutes: settings.idleSessionMinutes,
  };
}

function backupBrandingProjection(branding: PlatformBrandingSettings): Record<string, unknown> {
  const {
    productName,
    consoleTitle,
    tagline,
    primaryColor,
    secondaryColor,
    cornerStyle,
    logoUrl,
    faviconUrl,
    footerText,
    email,
    phone,
    website,
    legalName,
    registrationNumber,
    addressLine1,
    addressLine2,
    city,
    region,
    postalCode,
    country,
    socialLinks,
  } = branding;
  return {
    productName,
    consoleTitle,
    tagline,
    primaryColor,
    secondaryColor,
    cornerStyle,
    logoUrl,
    faviconUrl,
    footerText,
    email,
    phone,
    website,
    legalName,
    registrationNumber,
    addressLine1,
    addressLine2,
    city,
    region,
    postalCode,
    country,
    socialLinks,
  };
}

/** Builds the versioned, secret-free configuration snapshot. */
export async function buildPlatformConfigSnapshot(): Promise<PlatformConfigBackupSnapshot> {
  const [workspaces, admins] = await Promise.all([
    listWorkspaceRows({ limit: 5000 }),
    listPlatformUsers(),
  ]);

  return {
    format: PLATFORM_CONFIG_BACKUP_FORMAT,
    version: PLATFORM_CONFIG_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: backupSettingsProjection(
      getPlatformSettings(),
    ) as PlatformConfigBackupSnapshot["settings"],
    branding: backupBrandingProjection(
      getPlatformBranding(),
    ) as PlatformConfigBackupSnapshot["branding"],
    workspaces: workspaces.map((workspace) => ({
      subdomain: workspace.subdomain,
      name: workspace.madrasaName,
      enabled: workspace.enabled,
      createdAt: workspace.createdAt,
    })),
    admins: admins.map((admin) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions as unknown as Record<string, boolean>,
      disabled: Boolean(admin.disabledAt),
    })),
  };
}

/** Encrypts a platform-configuration snapshot with the operator credentials. */
export async function exportPlatformConfigBackup(credentials: {
  adminEmail: string;
  password: string;
}): Promise<{ fileName: string; file: string }> {
  const snapshot = await buildPlatformConfigSnapshot();
  const file = await encryptPlatformBackup(JSON.stringify(snapshot), credentials);
  const stamp = new Date().toISOString().slice(0, 10);
  return { fileName: `platform-config-${stamp}.mmsbackup.json`, file };
}

export type PlatformConfigImportResult = PlatformConfigBackupApplyResult;

/**
 * Validates (and optionally applies) an encrypted configuration backup. Only the
 * settings + branding sections are applied; workspace/admin registry sections are
 * reported as not applied because tenant data lives in separate databases and
 * credentials must never be restored from a file.
 */
export async function importPlatformConfigBackup(input: {
  file: string;
  email: string;
  password: string;
  dryRun?: boolean;
}): Promise<PlatformConfigImportResult> {
  const decrypted = await decryptPlatformBackup(input.file, {
    adminEmail: input.email,
    password: input.password,
  });
  if (!decrypted.ok) {
    throw Object.assign(new Error(decrypted.errorKey), {
      statusCode: 400,
      type: "validation_error",
    });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(decrypted.plaintext);
  } catch {
    throw Object.assign(new Error("backup.invalidFormat"), {
      statusCode: 400,
      type: "validation_error",
    });
  }
  const parsed = platformConfigBackupSnapshotSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw Object.assign(new Error("backup.invalidFormat"), {
      statusCode: 400,
      type: "validation_error",
    });
  }
  const snapshot = parsed.data;

  const result: PlatformConfigImportResult = {
    applied: { settings: false, branding: false },
    notApplied: {
      workspaces: snapshot.workspaces?.length ?? 0,
      admins: snapshot.admins?.length ?? 0,
    },
    warnings:
      (snapshot.workspaces?.length ?? 0) + (snapshot.admins?.length ?? 0) > 0
        ? ["Workspace and admin registry sections are informational only and were not applied."]
        : [],
  };

  if (input.dryRun) return result;

  const currentSettings = getPlatformSettings();
  const currentBranding = getPlatformBranding();
  const nextSettings = mergePlatformSettings({
    ...currentSettings,
    ...(snapshot.settings ?? {}),
  });
  const nextBranding = mergePlatformBranding({
    ...currentBranding,
    ...(snapshot.branding ?? {}),
  });

  await runInGlobalTransaction(async () => {
    await upsertPlatformSettingsRow(nextSettings, GLOBAL_SETTINGS_ID);
    await upsertPlatformBrandingRow(nextBranding, GLOBAL_BRANDING_ID);
  });

  setPlatformSettingsCache(nextSettings);
  setPlatformBrandingCache(nextBranding);
  try {
    await Promise.all([
      redisSet(REDIS_PLATFORM_SETTINGS_KEY, JSON.stringify(nextSettings), 86400),
      redisSet(REDIS_PLATFORM_BRANDING_KEY, JSON.stringify(nextBranding), 86400),
    ]);
  } catch {
    // Non-fatal
  }
  await Promise.all([
    invalidateMultiTierCache({ tenantId: "platform", domain: "settings", key: "global" }),
    invalidateMultiTierCache({ tenantId: "platform", domain: "branding", key: "global" }),
  ]);

  return {
    ...result,
    applied: {
      settings: snapshot.settings !== undefined,
      branding: snapshot.branding !== undefined,
    },
  };
}
