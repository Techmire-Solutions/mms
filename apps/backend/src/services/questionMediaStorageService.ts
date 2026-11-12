import { unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { resolveUploadsRoot } from "../config/uploadConfig.js";
import { parseQuestionMediaUrl, QUESTION_MEDIA_CATEGORY } from "../lib/questionMediaPolicy.js";

/**
 * Disk operations for question media.
 *
 * Question media lives in its own category directory, so the contact-attachment resolver (which only
 * understands `…/attachments/…`) must not be used for it. Paths are rebuilt from the parsed URL and
 * re-checked against traversal before any unlink.
 */

export function resolveQuestionMediaPath(tenant: string, url: string): string | null {
  const parsed = parseQuestionMediaUrl(url);
  if (!parsed) return null;
  if (parsed.tenant !== tenant.trim().toLowerCase()) return null;

  const dir = resolve(resolveUploadsRoot(), "tenants", parsed.tenant, QUESTION_MEDIA_CATEGORY);
  const full = resolve(dir, parsed.file);
  if (!full.startsWith(`${dir}${sep}`)) return null;
  return full;
}

/** Idempotent unlink; `false` when the file was already absent or the URL is foreign. */
export async function deleteQuestionMediaFile(tenant: string, url: string): Promise<boolean> {
  const path = resolveQuestionMediaPath(tenant, url);
  if (!path) return false;
  try {
    await unlink(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
