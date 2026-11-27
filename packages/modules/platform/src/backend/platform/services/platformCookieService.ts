import type { FastifyReply, FastifyRequest } from "fastify";
import { secureCookieBase } from "../deps.js";
import { attachTokenFromCookie } from "@mms/be-core/auth";

export const PLATFORM_ACCESS_COOKIE = "mms_platform_access";

export function attachPlatformTokenFromCookie(request: FastifyRequest): void {
  attachTokenFromCookie(request, PLATFORM_ACCESS_COOKIE);
}

/** Session cookie (no maxAge) — cleared when the browser closes. */
export function setPlatformAccessCookie(reply: FastifyReply, accessToken: string): void {
  (reply as any).setCookie(PLATFORM_ACCESS_COOKIE, accessToken, secureCookieBase());
}

export function clearPlatformAccessCookie(reply: FastifyReply): void {
  (reply as any).clearCookie(PLATFORM_ACCESS_COOKIE, secureCookieBase());
}
