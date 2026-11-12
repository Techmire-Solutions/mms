/**
 * Question media (stem/option images, audio and diagrams) upload policy.
 *
 * Lives outside `routes/common/uploads.ts` so the route stays inside the 300-line ceiling and the
 * policy is unit-testable without a Fastify instance. Question media is a distinct upload category:
 * it must not inherit the "any `…/attachments/…` file is a contact document" gate, and it is served
 * inline (an `<img>`/`<audio>` element) rather than as a forced download.
 */

/** Directory segment under `uploads/tenants/<tenant>/`. */
export const QUESTION_MEDIA_CATEGORY = "question-media";

const QUESTION_MEDIA_PATH_RE = /^\/uploads\/tenants\/([^/]+)\/question-media\/([^/]+)$/;

/** Images and short audio clips; anything else is rejected before the stream is written. */
export const QUESTION_MEDIA_MIME_ALLOWLIST = [
  "image/avif",
  "image/webp",
  "image/png",
  "image/jpeg",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/mp4",
] as const;

export function questionMediaMimeRejection(mimetype: string): string | null {
  const normalised = mimetype.trim().toLowerCase();
  return (QUESTION_MEDIA_MIME_ALLOWLIST as readonly string[]).includes(normalised)
    ? null
    : `Unsupported media type: ${mimetype}. Allowed: AVIF, WebP, PNG, JPEG, MP3, OGG, WAV, MP4 audio`;
}

/** URL of a question-media file for this tenant, or `null` when it is foreign or malformed. */
export function questionMediaUrlFor(tenant: string, url: string): string | null {
  if (typeof url !== "string" || url.trim() !== url || url.length === 0) return null;
  if (url.includes("\\")) return null;
  let pathname: string;
  try {
    pathname = new URL(url, "http://uploads.invalid").pathname;
  } catch {
    return null;
  }
  const match = QUESTION_MEDIA_PATH_RE.exec(pathname);
  if (!match) return null;
  const urlTenant = decodeURIComponent(match[1] ?? "").toLowerCase();
  const expected = tenant.trim().toLowerCase();
  return urlTenant === expected ? pathname : null;
}

/** `{tenant, file}` of a question-media URL, or `null` when it is not one. */
export function parseQuestionMediaUrl(url: string): { tenant: string; file: string } | null {
  if (typeof url !== "string" || url.trim() !== url || url.length === 0) return null;
  if (url.includes("\\")) return null;
  let pathname: string;
  try {
    pathname = new URL(url, "http://uploads.invalid").pathname;
  } catch {
    return null;
  }
  const match = QUESTION_MEDIA_PATH_RE.exec(pathname);
  if (!match) return null;
  const tenant = decodeURIComponent(match[1] ?? "").toLowerCase();
  const file = decodeURIComponent(match[2] ?? "");
  if (!tenant || !file || file === "." || file === ".." || /[\\/]/.test(file)) return null;
  return { tenant, file };
}

/**
 * Stable orphan-sweep reference key for a question-media URL (`<tenant>/question-media/<file>`).
 *
 * The attachments layout keeps its historical `<tenant>/<file>` key, so the two categories cannot
 * collide even when a file name repeats.
 */
export function questionMediaReferenceKey(url: string): string | null {
  const parsed = parseQuestionMediaUrl(url);
  return parsed ? `${parsed.tenant}/${QUESTION_MEDIA_CATEGORY}/${parsed.file}` : null;
}

/** `true` when an uploads path belongs to the question-media category. */
export function isQuestionMediaUploadPath(pathBelowUploads: string): boolean {
  const segments = pathBelowUploads.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  return (segments[segments.length - 2] ?? "") === QUESTION_MEDIA_CATEGORY;
}
