import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@mms/contracts";
import { bindRequestTenant } from "@mms/db/request-context";
import { logger } from "../logger/index.js";
import { stripUndefinedFields } from "./payloadTrimmer.js";
import { resolveSubdomainFromRequest } from "./tenantContext.js";

export interface RequestHooksPorts {
  /** Attaches the tenant access cookie token as a Bearer header. */
  attachTenantCookie(request: FastifyRequest): void;
  /** Attaches the platform access cookie token as a Bearer header. */
  attachPlatformCookie(request: FastifyRequest): void;
  /** Optional override for the 4xx/5xx request-failure log. */
  logFailedRequest?(
    request: FastifyRequest,
    reply: FastifyReply,
    meta: { tenant: string | null; userId?: string | number },
  ): void;
}

/**
 * Transport-level request hooks shared by both consoles:
 * - bind the tenant from the verified host before security plugins;
 * - attach the console-appropriate cookie token as a Bearer header;
 * - echo the request id;
 * - strip `undefined` serializer fields;
 * - log failed responses with tenant/user correlation.
 */
export function registerRequestHooks(app: FastifyInstance, ports: RequestHooksPorts): void {
  app.addHook("onRequest", (request, reply, done) => {
    reply.header("x-request-id", request.id);
    const subdomain = resolveSubdomainFromRequest(
      request.headers.host,
      request.headers["x-forwarded-host"] as string | string[] | undefined,
    );
    bindRequestTenant(subdomain);
    if (subdomain) {
      ports.attachTenantCookie(request);
    } else {
      ports.attachPlatformCookie(request);
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
      const user = (request as unknown as { user?: User }).user;
      const tenant = resolveSubdomainFromRequest(
        request.headers.host,
        request.headers["x-forwarded-host"] as string | string[] | undefined,
      );
      if (ports.logFailedRequest) {
        ports.logFailedRequest(request, reply, { tenant, userId: user?.id });
      } else {
        logger.warn(
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
    }
    done();
  });
}
