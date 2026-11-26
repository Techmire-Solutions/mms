import { existsSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServerConfig } from "../config/serverConfig.js";
import { resolveBackendRoot } from "../config/loadEnv.js";

import { setStaticAssetHeaders } from "./staticAssets.js";

/**
 * Prefixes that belong to the API, operational probes, or static build output —
 * never fall through to the SPA `index.html` with `200 text/html`.
 */
const NON_SPA_PREFIXES = [
  "/api",
  "/uploads",
  "/health",
  "/ready",
  "/metrics",
  "/ws",
  "/assets",
  "/.vite",
];

/** Root-level build/PWA files that must 404 when absent instead of serving HTML. */
const NON_SPA_ROOT_FILES = new Set([
  "/sw.js",
  "/registersw.js",
  "/manifest.json",
  "/site.webmanifest",
  "/robots.txt",
  "/llms.txt",
]);

/**
 * Known static asset extensions. Scoped to real asset types so client-side SPA
 * routes containing dots in slugs (e.g. `/students/st.john-academy`) still
 * receive `index.html`.
 */
const STATIC_ASSET_EXTENSION_RE =
  /\.(?:js|mjs|cjs|css|wasm|map|json|woff2?|ttf|otf|eot|ico|svg|png|webp|jpe?g|gif|avif|webmanifest|txt|xml)$/i;

const WORKBOX_SCRIPT_RE = /^\/workbox-[a-z0-9_-]+\.js$/i;

export interface WebAppsRootDirs {
  tenantDist: string;
  platformDist: string;
}

/**
 * Returns `true` when `pathname` targets an API/probe prefix, build `/assets`,
 * service worker, or static asset extension that must return HTTP 404 (never
 * `200 text/html` `index.html`) when missing on disk.
 */
export function isNonSpaFallbackPath(pathname: string): boolean {
  const raw = pathname.split("?")[0] ?? "/";
  let clean = raw.startsWith("/") ? raw : `/${raw}`;
  try {
    clean = decodeURIComponent(clean);
  } catch {
    return true;
  }

  if (clean.split("/").some((segment) => segment === ".." || segment === ".")) {
    return true;
  }

  if (NON_SPA_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`))) {
    return true;
  }

  const lower = clean.toLowerCase();
  if (NON_SPA_ROOT_FILES.has(lower) || WORKBOX_SCRIPT_RE.test(lower)) {
    return true;
  }

  const lastSegment = clean.slice(clean.lastIndexOf("/") + 1);
  return STATIC_ASSET_EXTENSION_RE.test(lastSegment);
}

/**
 * Apex detection mirrors `isApexHost` from `@mms/contracts`: a host is the apex
 * when it is not a tenant subdomain under `MMS_APP_DOMAIN`. With no configured
 * app domain (e.g. a bare host) we treat the request as apex.
 */
function isApexHostname(hostname: string, appDomain: string | undefined): boolean {
  const host = (hostname ?? "").toLowerCase().split(":")[0];
  const domain = (appDomain ?? "").toLowerCase().trim();
  if (!domain) return true;
  if (host === domain || host === `www.${domain}`) return true;
  return !host.endsWith(`.${domain}`);
}

function isRegularFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveSafeStaticFile(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "");
  if (!relative) return null;
  if (relative.split("/").some((segment) => segment === ".." || segment === ".")) {
    return null;
  }
  const normalizedRoot = resolve(root);
  const candidate = resolve(normalizedRoot, relative);
  if (!candidate.startsWith(`${normalizedRoot}${sep}`)) {
    return null;
  }
  return isRegularFile(candidate) ? relative : null;
}

export function sendNonSpaNotFound(reply: FastifyReply): FastifyReply {
  reply.header("Cache-Control", "no-store");
  return reply.status(404).send({ type: "not_found", message: "Not found" });
}

export function defaultWebAppsRootDirs(): WebAppsRootDirs {
  const webRoot = join(resolveBackendRoot(), "..");
  return {
    tenantDist: join(webRoot, "tenant-web", "dist"),
    platformDist: join(webRoot, "platform-web", "dist"),
  };
}

/**
 * Production: serve the two built SPAs on the API port (Apache → :5002).
 *
 * One `@fastify/static` instance is registered with `serve: false` so it only
 * decorates `reply.sendFile`; every request is routed to the host's dist —
 * `apps/platform-web/dist` on the apex, `apps/tenant-web/dist` on tenant hosts.
 * Missing `/assets/*`, `/sw.js`, and static file extensions return 404
 * (`Cache-Control: no-store`) so browsers and Workbox never receive HTML for a
 * module script; non-asset routes fall back to that host's `index.html`.
 */
export async function registerWebApps(
  app: FastifyInstance,
  config: ServerConfig,
  roots: WebAppsRootDirs = defaultWebAppsRootDirs(),
): Promise<boolean> {
  if (!config.isProd) {
    return false;
  }

  const { tenantDist, platformDist } = roots;
  const hasTenant = isRegularFile(join(tenantDist, "index.html"));
  const hasPlatform = isRegularFile(join(platformDist, "index.html"));

  if (!hasTenant && !hasPlatform) {
    app.log.warn(
      { tenantDist, platformDist },
      "Web app dist missing — skipping SPA static hosting",
    );
    return false;
  }

  await app.register(fastifyStatic, {
    root: hasTenant ? tenantDist : platformDist,
    // Disable the automatic wildcard route; we route per host in the handler.
    serve: false,
    decorateReply: true,
    preCompressed: false,
    // Never serve dotfiles from dist/ (e.g. a stray .env copied at build time).
    dotfiles: "deny",
    setHeaders(res, path) {
      setStaticAssetHeaders(res, path);
    },
  });

  app.get("/*", async (request: FastifyRequest, reply: FastifyReply) => {
    const pathname = request.url.split("?")[0] ?? "/";

    if (
      NON_SPA_PREFIXES.slice(0, 6).some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      )
    ) {
      return sendNonSpaNotFound(reply);
    }

    const apex = isApexHostname(request.hostname, config.appDomain);
    const root = apex ? platformDist : tenantDist;

    if (!existsSync(root) || !isRegularFile(join(root, "index.html"))) {
      const fallbackRoot = apex ? tenantDist : platformDist;
      if (existsSync(fallbackRoot)) {
        app.log.warn(
          { requestHost: request.hostname, root },
          "Web dist missing for host — returning 404",
        );
      }
      return sendNonSpaNotFound(reply);
    }

    const resolvedRelative = resolveSafeStaticFile(root, pathname);
    if (resolvedRelative) {
      setStaticAssetHeaders(reply, resolvedRelative);
      return reply.sendFile(resolvedRelative, root);
    }

    if (isNonSpaFallbackPath(pathname)) {
      return sendNonSpaNotFound(reply);
    }

    setStaticAssetHeaders(reply, "index.html");
    return reply.sendFile("index.html", root);
  });

  app.log.info(
    { tenantDist, platformDist, hasTenant, hasPlatform },
    "Serving web apps (tenant + platform) from Fastify",
  );
  return true;
}
