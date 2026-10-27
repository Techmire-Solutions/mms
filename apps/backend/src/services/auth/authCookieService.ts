import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { secureCookieBase } from "../../lib/cookieOptions.js";

const ACCESS_COOKIE = "mms_access";
const REFRESH_COOKIE = "mms_refresh";
const CSRF_COOKIE = "csrf_token";

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;
const CSRF_TTL_SEC = 7 * 24 * 60 * 60;

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7).trim() || null;
  }
  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  if (cookies?.[ACCESS_COOKIE]) return cookies[ACCESS_COOKIE];
  const rawCookie = request.headers.cookie;
  if (rawCookie) {
    const match = rawCookie.match(new RegExp(`(?:^|;\\s*)${ACCESS_COOKIE}=([^;]*)`));
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export function attachAccessTokenFromCookie(request: FastifyRequest): void {
  const token = extractBearerToken(request);
  if (token && !request.headers.authorization) {
    request.headers.authorization = `Bearer ${token}`;
  }
}

export function setCsrfCookie(reply: FastifyReply, token?: string): string {
  const csrfToken = token || generateCsrfToken();
  const base = secureCookieBase();
  reply.setCookie(CSRF_COOKIE, csrfToken, {
    path: "/",
    httpOnly: false, // Required for double-submit client read
    secure: base.secure,
    sameSite: "lax",
    maxAge: CSRF_TTL_SEC,
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
    maxAge: ACCESS_TTL_SEC,
  });
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    path: "/",
    httpOnly: true,
    secure: base.secure,
    sameSite: "lax",
    maxAge: REFRESH_TTL_SEC,
  });
  setCsrfCookie(reply, csrfToken);
}

export function clearAuthCookies(reply: FastifyReply): void {
  const base = secureCookieBase();
  reply.clearCookie(ACCESS_COOKIE, base);
  reply.clearCookie(REFRESH_COOKIE, base);
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
