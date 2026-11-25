import type { FastifyReply, FastifyRequest } from "fastify";
import { secureCookieBase } from "../../lib/cookieOptions.js";
import { attachTokenFromCookie } from "../../lib/attachTokenFromCookie.js";

export const PLATFORM_ACCESS_COOKIE = "mms_platform_access";

export function attachPlatformTokenFromCookie(request: FastifyRequest): void {
  attachTokenFromCookie(request, PLATFORM_ACCESS_COOKIE);
}

/** Session cookie (no maxAge) — cleared when the browser closes. */
export function setPlatformAccessCookie(reply: FastifyReply, accessToken: string): void {
  reply.setCookie(PLATFORM_ACCESS_COOKIE, accessToken, secureCookieBase());
}

export function clearPlatformAccessCookie(reply: FastifyReply): void {
  reply.clearCookie(PLATFORM_ACCESS_COOKIE, secureCookieBase());
}
