import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { resolveUploadsRoot } from "../config/uploadConfig.js";
import { runInGlobalTransaction } from "../db/dbTransactions.js";
import { activeDb } from "../db/database.js";
import { contactAttachments } from "../db/schema.js";
import {
  attachmentFileKey,
  selectOrphanAttachmentFiles,
  type AttachmentFileCandidate,
} from "./attachmentStorageService.js";

const DEFAULT_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export interface AttachmentSweepOptions {
  /** Delete candidates. `false` only reports what would be removed. */
  apply: boolean;
  root?: string;
  now?: number;
  minAgeMs?: number;
  /** Injection seam for tests; defaults to the global attachment-reference query. */
  loadReferencedKeys?: () => Promise<Set<string>>;
}

export interface AttachmentSweepResult {
  scanned: number;
  referencedKeys: number;
  orphans: number;
  deleted: number;
  orphanFiles: AttachmentFileCandidate[];
}

/** Walks `tenants/<tenant>/attachments/` under the uploads root. */
export async function collectTenantAttachmentFiles(
  root: string,
): Promise<AttachmentFileCandidate[]> {
  const tenantsDir = join(root, "tenants");
  const tenants = await readdir(tenantsDir, { withFileTypes: true }).catch(() => []);
  const files: AttachmentFileCandidate[] = [];

  for (const tenantEntry of tenants) {
    if (!tenantEntry.isDirectory()) continue;
    const dir = join(tenantsDir, tenantEntry.name, "attachments");
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const path = join(dir, entry.name);
      const info = await stat(path).catch(() => null);
      if (!info?.isFile()) continue;
      files.push({ tenant: tenantEntry.name, file: entry.name, path, mtimeMs: info.mtimeMs });
    }
  }
  return files;
}

/** Reference keys for every contact attachment row, including soft-deleted contacts. */
export async function loadReferencedAttachmentKeys(): Promise<Set<string>> {
  const rows = await runInGlobalTransaction(async () =>
    activeDb().select({ url: contactAttachments.url }).from(contactAttachments),
  );
  const keys = new Set<string>();
  for (const row of rows) {
    const key = attachmentFileKey(row.url);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Deletes unreferenced contact attachment files older than the age floor (B-03).
 *
 * References are loaded before any deletion, so a database failure cannot
 * remove files. Used by the manual script (dry-run by default) and the nightly
 * retention cycle (apply).
 */
export async function runAttachmentSweep(
  options: AttachmentSweepOptions,
): Promise<AttachmentSweepResult> {
  const minAgeMs = options.minAgeMs ?? DEFAULT_MIN_AGE_MS;
  const referenced = await (options.loadReferencedKeys ?? loadReferencedAttachmentKeys)();
  const files = await collectTenantAttachmentFiles(options.root ?? resolveUploadsRoot());
  const orphanFiles = selectOrphanAttachmentFiles(
    files,
    referenced,
    options.now ?? Date.now(),
    minAgeMs,
  );

  let deleted = 0;
  if (options.apply) {
    for (const orphan of orphanFiles) {
      try {
        await unlink(orphan.path);
        deleted += 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }

  return {
    scanned: files.length,
    referencedKeys: referenced.size,
    orphans: orphanFiles.length,
    deleted,
    orphanFiles,
  };
}
