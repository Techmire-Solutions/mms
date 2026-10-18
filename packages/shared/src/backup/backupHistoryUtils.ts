import type { AppTranslationKey } from "../i18n/appTranslations.js";
import {
  BACKUP_HISTORY_MAX,
  type WorkspaceBackupRecord,
  type WorkspaceBackupStats,
  type WorkspaceBackupSummary,
} from "./backupSchemas.js";
import { formatBackupSize } from "./backupEnvelopeUtils.js";

/** Prepends a new backup entry and enforces history limits. */
export function appendBackupHistory(
  history: WorkspaceBackupRecord[],
  entry: WorkspaceBackupRecord,
  max = BACKUP_HISTORY_MAX,
): WorkspaceBackupRecord[] {
  return [entry, ...history].slice(0, max);
}

export interface BackupCryptoCredentials {
  adminEmail: string;
  password: string;
}

export type BackupCredentials = BackupCryptoCredentials;

export interface PendingRestore {
  jsonText: string;
  summary: WorkspaceBackupSummary;
  fileName?: string;
  /** History entry the restore came from — drives the per-row progress state. */
  backupId?: string;
}

export type PendingDecrypt =
  | { kind: "file"; encryptedText: string; fileName: string; adminEmail: string }
  | { kind: "history"; backup: WorkspaceBackupRecord };

/**
 * Checks if an error message string matches a localized backup translation key format.
 */
export function isBackupErrorKey(message: string): message is AppTranslationKey {
  return message.startsWith("backup.");
}

/**
 * Creates a standard WorkspaceBackupRecord history log entry.
 */
export function createBackupHistoryEntry(
  dataStr: string,
  now: Date,
  name: string,
  stats: WorkspaceBackupStats,
  meta: { fileName: string; encrypted: boolean; adminEmail: string; maxInlineBytes: number },
): WorkspaceBackupRecord {
  return {
    id: `b${Date.now()}`,
    name,
    date: now.toISOString(),
    size: formatBackupSize(dataStr.length),
    status: "success",
    data: dataStr.length <= meta.maxInlineBytes ? dataStr : undefined,
    keyCount: stats.keyCount,
    collectionCount: stats.collectionCount,
    objectCount: stats.objectCount,
    fileName: meta.fileName,
    encrypted: meta.encrypted,
    adminEmail: meta.adminEmail,
  };
}
