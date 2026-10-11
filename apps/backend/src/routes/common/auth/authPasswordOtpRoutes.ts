import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import {
  requestTenantPasswordResetSchema,
  resetTenantPasswordSchema,
  verifyTenantPasswordResetSchema,
} from "@mms/shared";
import {
  requestTenantPasswordReset,
  resetTenantPassword,
  TenantPasswordOtpError,
  verifyTenantPasswordResetOtp,
} from "../../../services/auth/tenantPasswordOtpService.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { AUTH_RATE_LIMIT } from "../../../lib/rateLimitConfig.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";

/**
 * Public, rate-limited tenant "set your password" routes — one OTP mechanism
 * shared by a brand-new user's first activation and any existing user's
 * forgot-password (UI distinguishes the copy only).
 */
export const authPasswordOtpRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(async function passwordOtpRateLimited(inner) {
    await inner.register(rateLimit, AUTH_RATE_LIMIT);

    inner.post("/forgot-password", async (request, reply) => {
      const body = parseRequest(requestTenantPasswordResetSchema, request.body);
      if (!body.ok) return replyValidationError(reply, body.message);

      const subdomain = getRequestTenant();
      if (!subdomain) {
        return reply.status(400).send({
          type: "invalid_request",
          message: "Request this from your madrasa subdomain (e.g. your-madrasa.localhost).",
        });
      }

      const result = await requestTenantPasswordReset({
        email: body.data.email,
        workspaceSubdomain: subdomain,
      });
      return reply.send(result);
    });

    inner.post("/forgot-password/verify", async (request, reply) => {
      const body = parseRequest(verifyTenantPasswordResetSchema, request.body);
      if (!body.ok) return replyValidationError(reply, body.message);

      const subdomain = getRequestTenant();
      if (!subdomain) {
        return reply
          .status(400)
          .send({ type: "invalid_request", message: "Tenant context required" });
      }

      try {
        const result = await verifyTenantPasswordResetOtp({
          email: body.data.email,
          workspaceSubdomain: subdomain,
          code: body.data.code,
        });
        return reply.send(result);
      } catch (error: unknown) {
        if (error instanceof TenantPasswordOtpError) {
          return reply.status(error.statusCode).send({ type: error.code, message: error.message });
        }
        throw error;
      }
    });

    inner.post("/forgot-password/reset", async (request, reply) => {
      const body = parseRequest(resetTenantPasswordSchema, request.body);
      if (!body.ok) return replyValidationError(reply, body.message);

      const subdomain = getRequestTenant();
      if (!subdomain) {
        return reply
          .status(400)
          .send({ type: "invalid_request", message: "Tenant context required" });
      }

      try {
        const result = await resetTenantPassword({
          email: body.data.email,
          workspaceSubdomain: subdomain,
          code: body.data.code,
          password: body.data.password,
          jwtSigner: fastify.jwt,
          reply,
        });
        return reply.send({ user: result.user });
      } catch (error: unknown) {
        if (error instanceof TenantPasswordOtpError) {
          return reply.status(error.statusCode).send({ type: error.code, message: error.message });
        }
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({
          type: "server_error",
          message: err.message || "Failed to reset password",
        });
      }
    });
  });
};
