import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { ensureUploadsRoot } from "../config/uploadConfig.js";

export type HeaderTarget = {
  header: (name: string, value: string) => unknown;
};

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

  // Default for non-hashed, non-entry static files (e.g. general uploads, images)
  reply.header("Cache-Control", "public, max-age=86400");
  reply.header("Vary", "Accept-Encoding");
}

export async function registerStaticAssets(app: FastifyInstance): Promise<void> {
  const root = await ensureUploadsRoot();
  await app.register(fastifyStatic, {
    root,
    prefix: "/uploads/",
    decorateReply: false,
    preCompressed: true,
    setHeaders(res, path) {
      setStaticAssetHeaders(res, path);
    },
  });
}
