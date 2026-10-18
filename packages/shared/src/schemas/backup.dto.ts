import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

/** Identifies MMS workspace backup envelope files. */
export const BACKUP_FORMAT_ID = "mms-workspace-backup" as const;

/** Current envelope schema version. */
export const BACKUP_FORMAT_VERSION = 1;

const tenantDatabaseSnapshotBaseSchema = z
  .object({
    collections: z.record(z.string(), z.array(z.unknown())).optional(),
    objects: z.record(z.string(), z.unknown()).optional(),
    assets: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const tenantDatabaseSnapshotSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, tenantDatabaseSnapshotBaseSchema);

const workspaceBackupStatsBaseSchema = z
  .object({
    keyCount: z.number(),
    collectionCount: z.number(),
    objectCount: z.number(),
    byteSize: z.number(),
    entityBreakdown: z.record(z.string(), z.number()).optional(),
  })
  .strict();

export const workspaceBackupStatsSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, workspaceBackupStatsBaseSchema);

const workspaceBackupEnvelopeBaseSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT_ID),
    version: z.number().int().min(1),
    minCompatibleVersion: z.number().int().min(1).optional(),
    exportedAt: z.string(),
    subdomain: z.string().nullable(),
    dataSource: z.enum(["server", "local"]).optional(),
    checksum: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .optional(),
    stats: workspaceBackupStatsBaseSchema,
    keys: z.record(z.string(), z.string()),
  })
  .strict();

export const workspaceBackupEnvelopeSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, workspaceBackupEnvelopeBaseSchema);

export type WorkspaceBackupDataSource = "server" | "local";

export interface TenantDatabaseSnapshot {
  collections?: Record<string, unknown[]>;
  objects?: Record<string, unknown>;
  assets?: Record<string, string>;
}

export interface WorkspaceBackupEnvelope {
  format: typeof BACKUP_FORMAT_ID;
  version: number;
  minCompatibleVersion?: number;
  exportedAt: string;
  subdomain: string | null;
  dataSource?: WorkspaceBackupDataSource;
  checksum?: string;
  stats: WorkspaceBackupStats;
  keys: Record<string, string>;
}

export interface WorkspaceBackupStats {
  keyCount: number;
  collectionCount: number;
  objectCount: number;
  byteSize: number;
  entityBreakdown?: Record<string, number>;
}
