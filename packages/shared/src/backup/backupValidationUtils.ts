import type { AppTranslationKey } from "../i18n/appTranslations.js";
import {
  BACKUP_FORMAT_ID,
  BACKUP_FORMAT_VERSION,
  type WorkspaceBackupDataSource,
  type WorkspaceBackupEnvelope,
  type WorkspaceBackupSummaryResult,
} from "./backupSchemas.js";
import {
  buildStorageKeysFromSnapshot,
  computeBackupChecksum,
  computeBackupStats,
  extractBackupRawKeys,
  parseStorageKeysToSnapshot,
  remapBackupKeysToPrefix,
} from "./backupEnvelopeUtils.js";
import { hasPrototypePollution, validateAndNormalizeSnapshot } from "./backupSecurityUtils.js";

/** Result of a parsed and validated backup payload. */
export interface ValidatedBackupPayload {
  parsed: unknown;
  raw: Record<string, string>;
  remapped: Record<string, string>;
}

export type ParseAndValidateResult =
  { ok: true; data: ValidatedBackupPayload } | { ok: false; errorKey: AppTranslationKey };

/** Verifies cryptographic SHA-256 checksum if present in envelope. */
async function validateBackupPayloadChecksum(
  parsed: unknown,
  raw: Record<string, string>,
): Promise<boolean> {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).format === BACKUP_FORMAT_ID
  ) {
    const checksum = (parsed as WorkspaceBackupEnvelope).checksum;
    if (typeof checksum === "string" && checksum.length > 0) {
      const computed = await computeBackupChecksum(raw);
      return computed.toLowerCase() === checksum.toLowerCase();
    }
  }
  return true;
}

/**
 * Common internal logic for validating and parsing a workspace backup payload.
 * Enforces prototype pollution prevention, restricted key detection, version compatibility, and admin user verification.
 */
function parseAndValidateBackupPayload(
  jsonString: string,
  targetPrefix: string,
): ParseAndValidateResult {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    if (hasPrototypePollution(parsed)) {
      return { ok: false, errorKey: "backup.securityViolation" };
    }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      (parsed as Record<string, unknown>).format === BACKUP_FORMAT_ID
    ) {
      const envelope = parsed as WorkspaceBackupEnvelope;
      if (typeof envelope.version === "number" && envelope.version > BACKUP_FORMAT_VERSION) {
        return { ok: false, errorKey: "backup.unsupportedFutureVersion" };
      }
      if (
        typeof envelope.minCompatibleVersion === "number" &&
        envelope.minCompatibleVersion > BACKUP_FORMAT_VERSION
      ) {
        return { ok: false, errorKey: "backup.unsupportedFutureVersion" };
      }
    }

    const raw = extractBackupRawKeys(parsed);
    if (!raw) {
      return { ok: false, errorKey: "backup.invalidFormat" };
    }

    if (Object.keys(raw).length === 0) {
      return { ok: false, errorKey: "backup.emptyBackup" };
    }

    const remapped = remapBackupKeysToPrefix(raw, targetPrefix);
    if (Object.keys(remapped).length === 0) {
      return { ok: false, errorKey: "backup.invalidFormat" };
    }

    const snapshot = parseStorageKeysToSnapshot(remapped, targetPrefix);
    const validated = validateAndNormalizeSnapshot(snapshot);
    if (!validated.ok) {
      return { ok: false, errorKey: validated.errorKey };
    }

    const finalRemapped = buildStorageKeysFromSnapshot(validated.data, targetPrefix);

    return {
      ok: true,
      data: {
        parsed,
        raw,
        remapped: finalRemapped,
      },
    };
  } catch {
    return { ok: false, errorKey: "backup.invalidFormat" };
  }
}

/** Asynchronously validates and parses payload with full SHA-256 checksum verification. */
async function parseAndValidateBackupPayloadAsync(
  jsonString: string,
  targetPrefix: string,
): Promise<ParseAndValidateResult> {
  const syncResult = parseAndValidateBackupPayload(jsonString, targetPrefix);
  if (!syncResult.ok) return syncResult;

  const checksumValid = await validateBackupPayloadChecksum(
    syncResult.data.parsed,
    syncResult.data.raw,
  );
  if (!checksumValid) {
    return { ok: false, errorKey: "backup.checksumMismatch" };
  }

  return syncResult;
}

/** Summarizes a backup file for pre-restore preview (no writes). */
export function summarizeWorkspaceBackup(
  jsonString: string,
  targetPrefix: string,
): WorkspaceBackupSummaryResult {
  const result = parseAndValidateBackupPayload(jsonString, targetPrefix);
  if (!result.ok) {
    return result;
  }

  const { parsed, remapped } = result.data;
  const stats = computeBackupStats(remapped);
  const legacyFormat =
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).format !== BACKUP_FORMAT_ID;

  let exportedAt: string | null = null;
  let subdomain: string | null = null;
  let dataSource: WorkspaceBackupDataSource | null = null;
  let checksum: string | null = null;
  let version: number | undefined;

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).format === BACKUP_FORMAT_ID
  ) {
    const env = parsed as WorkspaceBackupEnvelope;
    exportedAt = typeof env.exportedAt === "string" ? env.exportedAt : null;
    subdomain = typeof env.subdomain === "string" ? env.subdomain : null;
    dataSource = env.dataSource === "server" || env.dataSource === "local" ? env.dataSource : null;
    checksum = typeof env.checksum === "string" ? env.checksum : null;
    version = typeof env.version === "number" ? env.version : undefined;
  }

  return {
    ok: true,
    summary: {
      ...stats,
      exportedAt,
      subdomain,
      legacyFormat,
      dataSource,
      checksum,
      version,
    },
  };
}

export type BackupValidationResult =
  { ok: true; data: Record<string, string> } | { ok: false; errorKey: AppTranslationKey };

/**
 * Validates exported workspace JSON before restore.
 * Accepts versioned envelope, tenant-scoped, or apex `mms_` keys.
 */
export function validateWorkspaceBackupJson(
  jsonString: string,
  targetPrefix: string,
  expectedSubdomain?: string | null,
): BackupValidationResult {
  const result = parseAndValidateBackupPayload(jsonString, targetPrefix);
  if (!result.ok) {
    return result;
  }
  if (expectedSubdomain) {
    const parsed = result.data.parsed;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      (parsed as Record<string, unknown>).format !== BACKUP_FORMAT_ID
    ) {
      return { ok: false, errorKey: "backup.workspaceUnidentified" };
    }
    const sourceSubdomain = (parsed as WorkspaceBackupEnvelope).subdomain;
    if (!sourceSubdomain) {
      return { ok: false, errorKey: "backup.workspaceUnidentified" };
    }
    if (sourceSubdomain.toLowerCase() !== expectedSubdomain.toLowerCase()) {
      return { ok: false, errorKey: "backup.workspaceMismatch" };
    }
  }
  return { ok: true, data: result.data.remapped };
}

/**
 * Asynchronously validates exported workspace JSON before restore, including SHA-256 checksum check.
 */
export async function validateWorkspaceBackupJsonAsync(
  jsonString: string,
  targetPrefix: string,
  expectedSubdomain?: string | null,
): Promise<BackupValidationResult> {
  const result = await parseAndValidateBackupPayloadAsync(jsonString, targetPrefix);
  if (!result.ok) {
    return result;
  }
  if (expectedSubdomain) {
    const parsed = result.data.parsed;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      (parsed as Record<string, unknown>).format !== BACKUP_FORMAT_ID
    ) {
      return { ok: false, errorKey: "backup.workspaceUnidentified" };
    }
    const sourceSubdomain = (parsed as WorkspaceBackupEnvelope).subdomain;
    if (!sourceSubdomain) {
      return { ok: false, errorKey: "backup.workspaceUnidentified" };
    }
    if (sourceSubdomain.toLowerCase() !== expectedSubdomain.toLowerCase()) {
      return { ok: false, errorKey: "backup.workspaceMismatch" };
    }
  }
  return { ok: true, data: result.data.remapped };
}
