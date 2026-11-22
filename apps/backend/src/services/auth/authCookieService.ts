import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "@mms/shared";
import { secureCookieBase } from "../../lib/cookieOptions.js";
import { extractTokenFromCookie } from "../../lib/attachTokenFromCookie.js";

const ACCESS_COOKIE = "mms_access";
const REFRESH_COOKIE = "mms_refresh";
const CSRF_COOKIE = "csrf_token";

/**
 * The refresh cookie is only needed by the refresh endpoint. Keeping it off
 * every other request (as mms-auth-security documents) narrows the exposure of
 * the 7-day token to path-scoped leaks and unnecessary subresource handlers.
 */
const REFRESH_PATH = "/api/auth/refresh";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7).trim() || null;
  }
  // Cookie fallback shares the SSOT cookie-lookup helper (parsed cookies, then
  // raw Cookie-header regex with URI decoding) with the platform cookie service.
  return extractTokenFromCookie(request, ACCESS_COOKIE);
}

export function attachAccessTokenFromCookie(request: FastifyRequest): void {
  const token = extractBearerToken(request);
  if (token && !request.headers.authorization) {
    request.headers.authorization = `Bearer ${token}`;
  }
}

/**
 * True when the request presents a tenant access token (Authorization header or `mms_access` cookie).
 *
 * The optional `/api/auth/session` probe uses this to decide whether the strict
 * `authenticateTenant` pipeline must run: with no token there is nothing to validate, so it can
 * answer `200 { user: null }` instead of a 401 the browser would log on the login page.
 */
export function hasTenantAccessToken(request: FastifyRequest): boolean {
  return extractBearerToken(request) !== null;
}

export function setCsrfCookie(reply: FastifyReply, token?: string): string {
  const csrfToken = token || generateCsrfToken();
  const base = secureCookieBase();
  reply.setCookie(CSRF_COOKIE, csrfToken, {
    path: "/",
    httpOnly: false, // Required for double-submit client read
    secure: base.secure,
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  return csrfToken;
}

export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
  csrfToken?: string,
): void {
  const base = secureCookieBase();
  reply.setCookie(ACCESS_COOKIE, accessToken, {
    path: "/",
    httpOnly: true,
    secure: base.secure,
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    path: REFRESH_PATH,
    httpOnly: true,
    secure: base.secure,
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  setCsrfCookie(reply, csrfToken);
}

export function clearAuthCookies(reply: FastifyReply): void {
  const base = secureCookieBase();
  reply.clearCookie(ACCESS_COOKIE, base);
  reply.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
  // Evict a legacy broad cookie set before the path narrowing; a browser that
  // still holds one would otherwise keep sending it to every path for 7 days.
  reply.clearCookie(REFRESH_COOKIE, { ...base, path: "/" });
  reply.clearCookie(CSRF_COOKIE, { path: "/", secure: base.secure, sameSite: "lax" });
}

/**
 * Dedicated key for OTP / refresh-token hashing, so the raw JWT signing secret
 * is never reused as a pepper for other primitives (key separation). Prefer a
 * dedicated `AUTH_ARTIFACT_SECRET`; otherwise derive a domain-separated key from
 * `JWT_SECRET` so existing deployments keep working without a new env var.
 */
function getAuthArtifactSecret(): string {
  const dedicated = process.env.AUTH_ARTIFACT_SECRET?.trim();
  if (dedicated) return dedicated;

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    // Fail closed: a predictable pepper makes refresh-token hashes and OTPs
    // forgeable. JWT_SECRET is mandatory to boot, so this only fires on
    // genuinely broken configuration.
    throw new Error(
      "No auth artifact secret configured. Set AUTH_ARTIFACT_SECRET (preferred) or JWT_SECRET.",
    );
  }

  return createHmac("sha256", "mms-auth-artifact-v1").update(jwtSecret).digest("hex");
}

export function hashOtpCode(code: string): string {
  return createHmac("sha256", getAuthArtifactSecret()).update(code).digest("hex");
}

export function verifyOtpCode(code: string, hash: string): boolean {
  const computed = hashOtpCode(code);
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 1_000_000));
}

export function hashRefreshToken(token: string): string {
  return scryptSync(token, getAuthArtifactSecret(), 32).toString("hex");
}

export function createRefreshTokenValue(): string {
  return randomBytes(32).toString("hex");
}

export { ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE };
