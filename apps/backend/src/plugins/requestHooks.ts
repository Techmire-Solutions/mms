import type { FastifyInstance } from "fastify";
import type { User } from "@mms/shared";
import { bindRequestTenant, resolveSubdomainFromRequest } from "../lib/tenantContext.js";
import { attachAccessTokenFromCookie } from "../services/auth/authCookieService.js";
import { attachPlatformTokenFromCookie } from "../services/platform/platformCookieService.js";
import { stripUndefinedFields } from "../lib/payloadTrimmer.js";

export function registerRequestHooks(app: FastifyInstance): void {
  app.addHook("onRequest", (request, reply, done) => {
    reply.header("x-request-id", request.id);
    const subdomain = resolveSubdomainFromRequest(
      request.headers.host,
      request.headers["x-forwarded-host"] as string | string[] | undefined,
    );
    bindRequestTenant(subdomain);
    if (subdomain) {
      attachAccessTokenFromCookie(request);
    } else {
      attachPlatformTokenFromCookie(request);
    }
    done();
  });

  app.addHook("preSerialization", async (_request, _reply, payload) => {
    if (
      payload &&
      typeof payload === "object" &&
      !Buffer.isBuffer(payload) &&
      typeof (payload as { pipe?: unknown }).pipe !== "function"
    ) {
      return stripUndefinedFields(payload);
    }
    return payload;
  });

  app.addHook("onResponse", (request, reply, done) => {
    if (reply.statusCode >= 400) {
      const user = request.user as User | undefined;
      const tenant = resolveSubdomainFromRequest(
        request.headers.host,
        request.headers["x-forwarded-host"] as string | string[] | undefined,
      );
      request.log.warn(
        {
          reqId: request.id,
          statusCode: reply.statusCode,
          method: request.method,
          url: request.url,
          tenant,
          userId: user?.id,
        },
        "request failed",
      );
    }
    done();
  });
}
