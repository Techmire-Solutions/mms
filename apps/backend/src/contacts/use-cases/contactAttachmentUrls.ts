import type { Contact } from "@mms/shared";
import { ValidationError } from "../../lib/httpErrors.js";

const TENANT_ATTACHMENT_PATH_RE = /^\/uploads\/tenants\/([^/]+)\/attachments\/([^/]+)$/;

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
 * New attachments may only reference the tenant's own upload directory. The
 * client can store a relative `/uploads/...` path (the frontend now does); the
 * path is validated rather than the host so proxies/subdomains are irrelevant,
 * and traversal/other-tenant/absolute URLs are rejected.
 */
export function isTenantAttachmentUrl(url: string, tenant: string): boolean {
  if (typeof url !== "string" || !url.startsWith("/") || url.includes("\\")) return false;
  let pathname: string;
  try {
    pathname = new URL(url, "http://attachments.invalid").pathname;
  } catch {
    return false;
  }
  const match = TENANT_ATTACHMENT_PATH_RE.exec(pathname);
  if (!match) return false;
  const urlTenant = decodeSegment(match[1]);
  const file = decodeSegment(match[2]);
  if (!urlTenant || !file) return false;
  return urlTenant.toLowerCase() === tenant.trim().toLowerCase();
}

/**
 * Grandfathers URLs already stored on the contact (legacy absolute uploads) and
 * rejects any new/changed attachment that is not a tenant upload path (B-04).
 */
export function assertContactAttachmentUrls(
  contact: Contact,
  tenant: string,
  allowedLegacyUrls: Iterable<string> = [],
): void {
  const allowed = new Set(allowedLegacyUrls);
  for (const attachment of contact.attachments ?? []) {
    if (allowed.has(attachment.url)) continue;
    if (!isTenantAttachmentUrl(attachment.url, tenant)) {
      throw new ValidationError(
        `Attachment "${attachment.name}" must be an uploaded file for this workspace`,
      );
    }
  }
}
