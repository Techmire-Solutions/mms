import type { AppTranslationKey } from "../i18n/appTranslations.js";
import type { WorkspaceBackupDataSource, WorkspaceBackupStats } from "../schemas/backup.dto.js";

export type WorkspaceBackupStatus = "success";

/** Maps a logical settings object key to its corresponding moduleId/collection name. */
export const SETTINGS_KEY_TO_MODULE: Record<string, string> = {
  contact_field_config: "contacts",
  students_settings: "students",
  faculty_settings: "faculty",
  users_settings: "users",
  attendance_settings: "attendance",
  sessions_settings: "sessions",
  enrollments_settings: "enrollments",
  finance_settings: "finance",
  obligations_settings: "obligations",
  accounting_settings: "accounting",
  hasanat_settings: "hasanat",
  examinations_settings: "examinations",
  question_bank_settings: "questionBank",
};

/** Maps a moduleId/collection name to its corresponding logical settings object key. */
export const MODULE_TO_SETTINGS_KEY: Record<string, string> = {};

// Populate dynamically from SETTINGS_KEY_TO_MODULE to enforce DRY
for (const [settingsKey, moduleName] of Object.entries(SETTINGS_KEY_TO_MODULE)) {
  MODULE_TO_SETTINGS_KEY[moduleName] = settingsKey;
}

// Add backward-compatibility singular/alias formats
MODULE_TO_SETTINGS_KEY["question-bank"] = "question_bank_settings";
MODULE_TO_SETTINGS_KEY["enrollment"] = "enrollments_settings";
MODULE_TO_SETTINGS_KEY["examination"] = "examinations_settings";

/** Max upload size for restore file picker (bytes). */
export const BACKUP_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

/** Local backup history entry (device export log). */
export interface WorkspaceBackupRecord {
  id: string;
  name: string;
  date: string;
  size: string;
  status: WorkspaceBackupStatus;
  /** Serialized export JSON — omitted when entry exceeds size cap. */
  data?: string;
  keyCount?: number;
  collectionCount?: number;
  objectCount?: number;
  /** Download filename used for this export. */
  fileName?: string;
  encrypted?: boolean;
  adminEmail?: string;
}

export const DEFAULT_BACKUP_HISTORY: WorkspaceBackupRecord[] = [];

/** Max history entries kept on device. */
export const BACKUP_HISTORY_MAX = 10;

/** Max JSON payload stored per history row (bytes). */
export const BACKUP_HISTORY_MAX_BYTES = 512_000;

export * from "../schemas/backup.dto.js";

export interface WorkspaceBackupSummary extends WorkspaceBackupStats {
  exportedAt: string | null;
  subdomain: string | null;
  legacyFormat: boolean;
  dataSource: WorkspaceBackupDataSource | null;
  checksum?: string | null;
  version?: number;
}

export type WorkspaceBackupSummaryResult =
  { ok: true; summary: WorkspaceBackupSummary } | { ok: false; errorKey: AppTranslationKey };
