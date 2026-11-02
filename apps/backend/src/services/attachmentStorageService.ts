import { and, eq, inArray } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { resolveUploadsRoot } from "../config/uploadConfig.js";
import { contactAttachments } from "../db/schema.js";
import { withTenantRead } from "../db/tenant-context.js";

/**
 * `/uploads/tenants/<tenant>/attachments/<file>` — exactly one segment for each
 * part. Encoded slashes/dots are decoded and re-checked before use.
 */
const TENANT_ATTACHMENT_PATH_RE = /^\/uploads\/tenants\/([^/]+)\/attachments\/([^/]+)$/;

const ABSOLUTE_URL_RE = /^https?:\/\//i;

function decodeSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    if (!decoded || decoded === "." || decoded === ".." || /[\\/]/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Stable `<tenant>/<file>` key for a tenant attachment URL (relative or absolute),
 * or `null` when the URL is not a tenant attachment path. Shared by the unlink
 * endpoint and the orphan sweep so both speak the same key space.
 */
export function attachmentFileKey(url: string): string | null {
  if (typeof url !== "string" || url.trim() !== url || url.length === 0) return null;
  if (!url.startsWith("/") && !ABSOLUTE_URL_RE.test(url)) return null;
  if (url.includes("\\")) return null;

  let pathname: string;
  try {
    pathname = new URL(url, "http://uploads.invalid").pathname;
  } catch {
    return null;
  }
  const match = TENANT_ATTACHMENT_PATH_RE.exec(pathname);
  if (!match) return null;
  const tenant = decodeSegment(match[1]);
  const file = decodeSegment(match[2]);
  if (!tenant || !file) return null;
  return `${tenant.toLowerCase()}/${file}`;
}

/** Absolute disk path for a tenant attachment URL, or `null` when it is invalid/foreign. */
export function resolveTenantAttachmentPath(tenant: string, url: string): string | null {
  const key = attachmentFileKey(url);
  if (!key) return null;
  const [keyTenant, file] = key.split("/");
  const expectedTenant = tenant.trim().toLowerCase();
  if (!keyTenant || keyTenant !== expectedTenant || !file) return null;

  const dir = resolve(resolveUploadsRoot(), "tenants", keyTenant, "attachments");
  const full = resolve(dir, file);
  if (!full.startsWith(`${dir}${sep}`)) return null;
  return full;
}

/** True when any contact attachment row still stores this URL (or its relative form). */
export async function isAttachmentReferenced(tenant: string, url: string): Promise<boolean> {
  const key = attachmentFileKey(url);
  const candidates = new Set<string>([url]);
  if (key) candidates.add(`/uploads/${key}`);
  const rows = await withTenantRead(tenant, (tx) =>
    tx
      .select({ id: contactAttachments.id })
      .from(contactAttachments)
      .where(
        and(
          eq(contactAttachments.workspaceSubdomain, tenant),
          inArray(contactAttachments.url, [...candidates]),
        ),
      )
      .limit(1),
  );
  return rows.length > 0;
}

/** Idempotent unlink; returns false when the file was already absent. */
export async function deleteTenantAttachment(tenant: string, url: string): Promise<boolean> {
  const path = resolveTenantAttachmentPath(tenant, url);
  if (!path) return false;
  try {
    await unlink(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export interface AttachmentFileCandidate {
  tenant: string;
  file: string;
  path: string;
  mtimeMs: number;
}

/**
 * Pure selection used by the orphan sweep: files older than the age floor whose
 * `<tenant>/<file>` key is not referenced by any contact attachment row.
 */
export function selectOrphanAttachmentFiles(
  files: AttachmentFileCandidate[],
  referencedKeys: ReadonlySet<string>,
  nowMs: number,
  minAgeMs: number,
): AttachmentFileCandidate[] {
  return files.filter(
    (file) =>
      nowMs - file.mtimeMs >= minAgeMs &&
      !referencedKeys.has(`${file.tenant.toLowerCase()}/${file.file}`),
  );
}
