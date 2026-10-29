import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ensureUploadsRoot } from "../config/uploadConfig.js";
import { authenticateUploader } from "../middleware/authenticateUploader.js";
import { getRequestTenant } from "../lib/tenantContext.js";
import { sendForbidden } from "../lib/httpErrors.js";

export type HeaderTarget = {
  header: (name: string, value: string) => unknown;
};

/**
 * Upload categories rendered before a session exists: the apex/login chrome and
 * the workspace logo shown on the sign-in page (`tenants/<t>/branding/...`).
 * Avatars are personal staff/student photos and stay session-gated; everything
 * else under `/uploads/` — exports, attachments, general images — is too.
 */
const PUBLIC_UPLOAD_CATEGORIES = new Set(["branding"]);

/** `/uploads/tenants/<tenant>/…` — everything below this is tenant data. */
const TENANT_UPLOAD_PREFIX = "tenants/";

/**
 * Edge & browser caching strategy for MMS static and user-uploaded assets.
 * - Hashed assets (/assets/*.js, /assets/*.css): Cache-Control: public, max-age=31536000, immutable
 * - Brand & root assets (/favicon.ico, /favicon.svg, /platform-logo.*, /icon-*.png): Cache-Control: public, max-age=86400, must-revalidate
 * - Application shell entry files (index.html, site.webmanifest): Cache-Control: no-cache, no-store, must-revalidate
 * - Attachments: Content-Type: application/octet-stream, Content-Disposition: attachment
 */
export function setStaticAssetHeaders(reply: HeaderTarget, filePath: string): void {
  const normalized = filePath.replace(/\\/g, "/");
  // Strip .br or .gz extension if preCompressed served a compressed artifact
  const cleanPath = normalized.replace(/\.(?:br|gz)$/i, "");

  if (cleanPath.includes("/attachments/")) {
    reply.header("Content-Type", "application/octet-stream");
    reply.header("Content-Disposition", "attachment");
    // Attachments are pupil/finance documents even at the root level (no
    // `tenants/<t>/` segment). This branch returns before the tenant rule, so
    // the private cache contract must be applied HERE explicitly — otherwise
    // @fastify/static/send leaves `Cache-Control: public, max-age=0` and a
    // shared proxy may store the file.
    reply.header("Cache-Control", "private, no-store");
    reply.header("Vary", "Authorization, Accept-Encoding");
    return;
  }

  // 1. Brand & Root Assets (/favicon.ico, /favicon.svg, /platform-logo.*, /icon-*.png, etc.)
  if (
    /(?:^|[\\/])(?:favicon\.(?:ico|svg|png)|platform-logo\.[a-z0-9]+|icon-[a-z0-9_-]+\.png|apple-touch-icon.*\.png)$/i.test(
      cleanPath,
    )
  ) {
    reply.header("Cache-Control", "public, max-age=86400, must-revalidate");
    reply.header("Vary", "Accept-Encoding");
    return;
  }

  // 2. Hashed Assets (/assets/*.[hash].js, /assets/*.[hash].css, etc.)
  if (
    /(?:^|[\\/])assets[\\/]/i.test(cleanPath) ||
    /[\\/]assets[\\/].*\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(cleanPath) ||
    /[-.][A-Za-z0-9_-]{8,}\.(?:js|css)$/i.test(cleanPath)
  ) {
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    reply.header("Vary", "Accept-Encoding");
    return;
  }

  // 3. Application shell entry & manifest files (index.html, site.webmanifest, manifest.json, sw.js)
  if (/(?:^|[\\/])(?:index\.html|site\.webmanifest|manifest\.json|sw\.js)$/i.test(cleanPath)) {
    reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
    reply.header("Pragma", "no-cache");
    reply.header("Vary", "Accept-Encoding");
    return;
  }

  // User-uploaded documents (exports, attachments, tenant images) may contain
  // pupil/finance data — never let a shared proxy cache them.
  if (/(?:^|[\\/])uploads[\\/]tenants[\\/]/i.test(cleanPath)) {
    reply.header("Cache-Control", "private, no-store");
    reply.header("Vary", "Authorization, Accept-Encoding");
    return;
  }

  // Default for non-hashed, non-entry static files (public branding, images)
  reply.header("Cache-Control", "public, max-age=86400");
  reply.header("Vary", "Accept-Encoding");
}

/**
 * Path below `/uploads/`, URL-decoded and normalised. Returns `null` for a
 * traversal attempt so the caller can reject it.
 */
export function uploadPathFromUrl(url: string): string | null {
  const withoutQuery = url.split("?")[0] ?? "";
  const afterPrefix = withoutQuery.startsWith("/uploads/")
    ? withoutQuery.slice("/uploads/".length)
    : withoutQuery;
  let decoded: string;
  try {
    decoded = decodeURIComponent(afterPrefix);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((segment) => segment === ".." || segment === ".")) {
    return null;
  }
  return normalized;
}

/**
 * Branding is rendered before sign-in and stays public, whichever directory
 * layout it uses (`branding/x.png` or `tenants/<t>/branding/x.png`).
 */
export function isPublicUploadPath(pathBelowUploads: string): boolean {
  const segments = pathBelowUploads.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  const category = segments[segments.length - 2]?.toLowerCase() ?? "";
  return PUBLIC_UPLOAD_CATEGORIES.has(category);
}

/** Tenant segment of `tenants/<tenant>/…`, or `null` for platform-level paths. */
export function tenantSegmentOf(pathBelowUploads: string): string | null {
  if (!pathBelowUploads.startsWith(TENANT_UPLOAD_PREFIX)) return null;
  const rest = pathBelowUploads.slice(TENANT_UPLOAD_PREFIX.length);
  const [segment] = rest.split("/");
  return segment ? segment.toLowerCase() : null;
}

/**
 * Authorizes a `/uploads/*` request.
 *
 * Uploads used to be served by a bare `@fastify/static` registration: no auth,
 * `Cache-Control: public`, and exempt from rate limiting — so any leaked export
 * URL was downloadable by anyone, and proxy-cached. Now only branding is
 * public; everything else needs a valid session, and tenant-scoped paths must
 * match the caller's tenant.
 */
async function authorizeUpload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const path = uploadPathFromUrl(request.url);
  if (path === null) {
    await sendForbidden(reply, "Invalid upload path");
    return;
  }
  if (isPublicUploadPath(path)) return;

  await authenticateUploader(request, reply);
  if (reply.sent) return;

  const pathTenant = tenantSegmentOf(path);
  if (!pathTenant) return;

  const requestTenant = getRequestTenant();
  if (requestTenant && requestTenant.toLowerCase() !== pathTenant) {
    await sendForbidden(reply, "This file belongs to another workspace");
  }
}

export async function registerStaticAssets(app: FastifyInstance): Promise<void> {
  const root = await ensureUploadsRoot();
  await app.register(async (scope) => {
    scope.addHook("onRequest", authorizeUpload);
    await scope.register(fastifyStatic, {
      root,
      prefix: "/uploads/",
      decorateReply: false,
      preCompressed: true,
      // Never serve dotfiles (.env, editor leftovers): a stray dotfile in the
      // uploads root must not become downloadable.
      dotfiles: "deny",
      setHeaders(res, path) {
        setStaticAssetHeaders(res, path);
      },
    });
  });
}
