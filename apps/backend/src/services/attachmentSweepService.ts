import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { resolveUploadsRoot } from "../config/uploadConfig.js";
import { runInGlobalTransaction } from "../db/dbTransactions.js";
import { activeDb } from "../db/database.js";
import { contactAttachments, questionAttachments } from "../db/schema.js";
import {
  attachmentFileKey,
  selectOrphanAttachmentFiles,
  type AttachmentFileCandidate,
} from "./attachmentStorageService.js";
import { QUESTION_MEDIA_CATEGORY, questionMediaReferenceKey } from "../lib/questionMediaPolicy.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";

/**
 * Directories under `tenants/<tenant>/` that hold referenced files and are safe to sweep.
 *
 * `images/` is deliberately excluded: avatars, branding and general images have no reference table
 * yet, so sweeping that directory would delete live files. Recorded as deferred in the audit.
 */
const SWEPT_CATEGORIES = ["attachments", QUESTION_MEDIA_CATEGORY] as const;

const DEFAULT_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export interface AttachmentSweepOptions {
  /** Delete candidates. `false` only reports what would be removed. */
  apply: boolean;
  root?: string;
  now?: number;
  minAgeMs?: number;
  /** Injection seam for tests; defaults to the global attachment-reference query. */
  loadReferencedKeys?: () => Promise<Set<string>>;
  /** Worker shutdown signal: stops the sweep between tenants and between unlinks. */
  signal?: AbortSignal;
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
    for (const category of SWEPT_CATEGORIES) {
      const dir = join(tenantsDir, tenantEntry.name, category);
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const path = join(dir, entry.name);
        const info = await stat(path).catch(() => null);
        if (!info?.isFile()) continue;
        files.push({
          tenant: tenantEntry.name,
          file: entry.name,
          path,
          mtimeMs: info.mtimeMs,
          ...(category === QUESTION_MEDIA_CATEGORY
            ? { key: `${tenantEntry.name.toLowerCase()}/${category}/${entry.name}` }
            : {}),
        });
      }
    }
  }
  return files;
}

/**
 * Reference keys for every attachment row, including soft-deleted questions and contacts.
 *
 * Question media is a first-class reference source (0242): without it the nightly sweep would treat
 * every question image as an orphan and delete it after the age floor.
 */
export async function loadReferencedAttachmentKeys(): Promise<Set<string>> {
  const { contactRows, questionRows } = await runInGlobalTransaction(async () => {
    const contacts = await activeDb()
      .select({ url: contactAttachments.url })
      .from(contactAttachments);
    const questionMedia = await activeDb()
      .select({ url: questionAttachments.url })
      .from(questionAttachments);
    return { contactRows: contacts, questionRows: questionMedia };
  });
  const keys = new Set<string>();
  for (const row of contactRows) {
    const key = attachmentFileKey(row.url);
    if (key) keys.add(key);
  }
  for (const row of questionRows) {
    const key = questionMediaReferenceKey(row.url);
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
  throwIfBackgroundJobAborted(options.signal);
  // References are loaded before any deletion: a failed/aborted load must never remove files.
  const referenced = await (options.loadReferencedKeys ?? loadReferencedAttachmentKeys)();
  throwIfBackgroundJobAborted(options.signal);
  const files = await collectTenantAttachmentFiles(options.root ?? resolveUploadsRoot());
  const orphanFiles = selectOrphanAttachmentFiles(
    files,
    referenced,
    options.now ?? Date.now(),
    minAgeMs,
  );

  let deleted = 0;
  if (options.apply) {
    for (const [index, orphan] of orphanFiles.entries()) {
      if (index % 25 === 0) throwIfBackgroundJobAborted(options.signal);
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
