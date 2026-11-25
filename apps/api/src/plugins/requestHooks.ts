import type { FastifyInstance } from "fastify";
import { registerRequestHooks as registerCoreRequestHooks } from "@mms/be-core/http";
import { attachAccessTokenFromCookie } from "../services/auth/authCookieService.js";
import { attachPlatformTokenFromCookie } from "../services/platform/platformCookieService.js";

export function registerRequestHooks(app: FastifyInstance): void {
  registerCoreRequestHooks(app, {
    attachTenantCookie: (request) => attachAccessTokenFromCookie(request),
    attachPlatformCookie: (request) => attachPlatformTokenFromCookie(request),
  });
}
