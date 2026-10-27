import type { FastifyReply, FastifyRequest } from "fastify";
import { secureCookieBase } from "../../lib/cookieOptions.js";

export const PLATFORM_ACCESS_COOKIE = "mms_platform_access";

export function attachPlatformTokenFromCookie(request: FastifyRequest): void {
  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  let token = cookies?.[PLATFORM_ACCESS_COOKIE];
  if (!token && request.headers.cookie) {
    const match = request.headers.cookie.match(
      new RegExp(`(?:^|;\\s*)${PLATFORM_ACCESS_COOKIE}=([^;]*)`),
    );
    if (match?.[1]) token = decodeURIComponent(match[1]);
  }
  if (token && !request.headers.authorization) {
    request.headers.authorization = `Bearer ${token}`;
  }
}

/** Session cookie (no maxAge) — cleared when the browser closes. */
export function setPlatformAccessCookie(reply: FastifyReply, accessToken: string): void {
  reply.setCookie(PLATFORM_ACCESS_COOKIE, accessToken, secureCookieBase());
}

export function clearPlatformAccessCookie(reply: FastifyReply): void {
  reply.clearCookie(PLATFORM_ACCESS_COOKIE, secureCookieBase());
}
