import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isOriginAllowedForAppDomain, isTrustedWorkspaceOrigin } from "@mms/shared";
import type { ServerConfig } from "../config/serverConfig.js";
import { requestHostname } from "../lib/requestHost.js";
import { PLATFORM_ACCESS_COOKIE } from "../services/platform/platformCookieService.js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const BODY_MUTATION_METHODS = new Set(["POST", "PUT", "PATCH"]);

function getHeaderString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

/** Parses Cookie header once into a key-value record with safe URI decoding. */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(";");

  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    let val = pair.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

/** Constant-time string comparison to mitigate timing side-channels. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isOriginAllowed(origin: string, requestHost: string, config: ServerConfig): boolean {
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname.toLowerCase();

    // In production, reject unencrypted HTTP origins (except localhost/127.0.0.1)
    if (
      config.isProd &&
      originUrl.protocol !== "https:" &&
      originHost !== "localhost" &&
      originHost !== "127.0.0.1"
    ) {
      return false;
    }

    // 1. Direct match with current request host
    if (originHost === requestHost) {
      return true;
    }

    // 2. Explicit config.allowedOrigin (supports comma-delimited list)
    if (config.allowedOrigin) {
      const allowed = config.allowedOrigin.split(",").map((o) => o.trim());
      if (allowed.includes(origin)) {
        return true;
      }
    }

    const appDomain = process.env.MMS_APP_DOMAIN?.trim();
    if (appDomain && isOriginAllowedForAppDomain(origin, appDomain)) {
      return true;
    }

    // 3. Local dev origins
    if (!config.isProd && isTrustedWorkspaceOrigin(origin)) {
      return true;
    }

    // 4. Localhost fallback in non-prod
    if (!config.isProd && (originHost === "localhost" || originHost === "127.0.0.1")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Enforces same-origin / allowed-origin and Sec-Fetch-Site guards on all cookie-auth state-changing mutations.
 * Also enforces application/json content-type on JSON API write paths.
 */
export function registerCsrfOriginGuard(app: FastifyInstance, config: ServerConfig): void {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();
    if (!MUTATION_METHODS.has(method)) {
      return;
    }

    // 1. Sec-Fetch-Site browser header defense
    const secFetchSiteHeader = getHeaderString(request.headers["sec-fetch-site"]);
    if (secFetchSiteHeader) {
      const sites = secFetchSiteHeader
        .toLowerCase()
        .split(",")
        .map((s) => s.trim());
      if (sites.includes("cross-site")) {
        reply.status(403).send({
          type: "forbidden",
          message: "Cross-site mutation blocked",
        });
        return reply;
      }
    }

    // 2. Origin / Referer validation. Track whether any positive origin signal
    // was present so we can fail closed below for silent cookie-auth clients.
    // Note: Sec-Fetch-Site is deliberately NOT counted as a positive origin
    // signal — it is trivially spoofable by non-browser clients, so a cookie-auth
    // mutation carrying only Sec-Fetch-Site (no Origin/Referer) and no CSRF token
    // must still fail closed.
    const origin = getHeaderString(request.headers.origin);
    const requestHost = requestHostname(request);
    const hadOriginSignal = Boolean(origin) || Boolean(request.headers.referer);

    if (origin) {
      if (!isOriginAllowed(origin, requestHost, config)) {
        reply.status(403).send({
          type: "forbidden",
          message: "Untrusted origin blocked",
        });
        return reply;
      }
    } else {
      const referer = getHeaderString(request.headers.referer);
      if (referer) {
        try {
          const refererOrigin = new URL(referer).origin;
          if (!isOriginAllowed(refererOrigin, requestHost, config)) {
            reply.status(403).send({
              type: "forbidden",
              message: "Untrusted referer blocked",
            });
            return reply;
          }
        } catch {
          reply.status(403).send({
            type: "forbidden",
            message: "Malformed referer blocked",
          });
          return reply;
        }
      }
    }

    // 3. JSON Content-Type check on API mutations
    const pathname = request.url.split("?")[0] ?? "";
    const contentType = getHeaderString(request.headers["content-type"])?.toLowerCase() ?? "";
    const isUploadPath =
      pathname.startsWith("/uploads") ||
      pathname.includes("/upload") ||
      pathname.includes("/import");
    const isApiMutation = pathname.startsWith("/api") && MUTATION_METHODS.has(method);

    // 4. Double-submit CSRF token for cookie-auth API mutations, plus a
    // fail-closed guard for cookie-auth mutations with no browser origin
    // signal at all (e.g. non-browser or header-stripped clients).
    const cookies = parseCookies(getHeaderString(request.headers.cookie));
    const csrfCookieValue = cookies["csrf_token"];
    const hasCsrfCookie = Boolean(csrfCookieValue);
    // Both the tenant session cookie and the apex platform session cookie are
    // trusted cookie-auth signals, so the double-submit and fail-closed paths
    // cover platform mutations too.
    const hasSessionCookie =
      Boolean(cookies["mms_access"]) || Boolean(cookies[PLATFORM_ACCESS_COOKIE]);

    if (isApiMutation) {
      if (hasCsrfCookie) {
        const headerToken = getHeaderString(request.headers["x-csrf-token"]);
        if (!headerToken || !safeEqual(headerToken, csrfCookieValue)) {
          reply.status(403).send({
            type: "forbidden",
            message: "Invalid or missing CSRF token",
          });
          return reply;
        }
      } else if (hasSessionCookie && !hadOriginSignal) {
        // Cookie-session mutation carrying no Origin / Referer / Sec-Fetch-Site
        // and no double-submit token: fail closed rather than accept silently.
        reply.status(403).send({
          type: "forbidden",
          message: "Missing origin or CSRF token",
        });
        return reply;
      }
    }

    // 5. JSON media-type enforcement on API mutations
    if (isApiMutation && !isUploadPath && BODY_MUTATION_METHODS.has(method)) {
      const contentLength = getHeaderString(request.headers["content-length"]);
      const isChunked = getHeaderString(request.headers["transfer-encoding"])?.includes("chunked");
      const hasBody = (contentLength !== undefined && contentLength !== "0") || isChunked;

      if (hasBody || contentType) {
        const isJson =
          contentType.includes("application/json") ||
          contentType.includes("application/problem+json");
        const isMultipart = contentType.includes("multipart/form-data");

        if (!isJson && !isMultipart) {
          reply.status(415).send({
            type: "unsupported_media_type",
            message: "Content-Type must be application/json",
          });
          return reply;
        }
      }
    }
  });
}
