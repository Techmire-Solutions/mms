import type { FastifyRequest } from "fastify";

/**
 * SSOT for reading an auth token out of a request cookie, shared by the tenant
 * and platform cookie services (mms-dry §2).
 *
 * Reads the parsed cookies first; when the cookie parser has not run yet (or
 * did not populate the entry), falls back to the raw `Cookie` header with the
 * shared regex `(?:^|;\s*)NAME=([^;]*)` and URI-decodes the captured value.
 */

/** Extracts the named cookie token, or `null` when it is absent/empty. */
export function extractTokenFromCookie(request: FastifyRequest, cookieName: string): string | null {
  const cookies = (request as unknown as { cookies?: Record<string, string | undefined> }).cookies;
  let token = cookies?.[cookieName];
  if (!token && request.headers.cookie) {
    const match = request.headers.cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`));
    if (match?.[1]) token = decodeURIComponent(match[1]);
  }
  return token || null;
}

/**
 * Attaches the named cookie token as an `Authorization: Bearer …` header so
 * downstream JWT verification sees a uniform credential. An explicitly
 * presented Authorization header always wins and is never overwritten.
 */
export function attachTokenFromCookie(request: FastifyRequest, cookieName: string): void {
  const token = extractTokenFromCookie(request, cookieName);
  if (token && !request.headers.authorization) {
    request.headers.authorization = `Bearer ${token}`;
  }
}
