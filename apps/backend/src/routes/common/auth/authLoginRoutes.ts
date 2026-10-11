import type { FastifyPluginAsync } from "fastify";
import {
  loginUser,
  onboardUser,
  completeTwoFactorLogin,
} from "../../../services/auth/authService.js";
import { resendTwoFactorChallenge } from "../../../services/auth/twoFactorService.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { AUTH_RATE_LIMIT } from "../../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../../lib/rateLimitGuard.js";
import {
  authenticatePlatform,
  requirePlatformPermission,
  type PlatformAuthenticatedRequest,
} from "../../../middleware/authenticatePlatform.js";
import {
  onboardBodySchema,
  challengeCodeBodySchema,
  challengeIdBodySchema,
  loginBodySchema,
  type TenantLoginResponse,
  type TenantAuthError,
} from "@mms/shared";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendNotFound } from "../../../lib/httpErrors.js";
import { insertPlatformActivityLog } from "../../../db/repositories/platformActivityLogsRepository.js";
import { verifyPlatformUserPassword } from "../../../services/platform/platformUserService.js";

/** Rate-limited login, onboarding, and two-factor challenge routes. */
export const authLoginRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(async function authRateLimited(inner) {
    // Must use the strict guard: the global limiter has already marked the
    // request, so `inner.register(rateLimit, …)` would be a silent no-op.
    inner.addHook("preHandler", createStrictRateLimitGuard(inner, AUTH_RATE_LIMIT));

    inner.post("/login", async (request, reply) => {
      const body = parseRequest(loginBodySchema, request.body);
      if (!body.ok) return replyValidationError(reply, body.message);
      const { email, password } = body.data;
      const subdomain = getRequestTenant();

      if (!subdomain) {
        const error: TenantAuthError = {
          type: "invalid_credentials",
          message: "Sign in on your madrasa subdomain (e.g. your-madrasa.localhost).",
        };
        return reply.status(400).send(error);
      }

      try {
        const result = await loginUser(email, password, subdomain, fastify.jwt, reply);

        if (result) {
          if (result.requires2FA) {
            const payload: TenantLoginResponse = {
              user: result.user,
              requires2FA: true,
              challengeId: result.challengeId,
            };
            return reply.send(payload);
          }
          const payload: TenantLoginResponse = { user: result.user, requires2FA: false };
          return reply.send(payload);
        }
      } catch (error: unknown) {
        const err = error as Error & { statusCode?: number; type?: string };
        if (err.statusCode === 403 && err.type === "workspace_disabled") {
          const disabledError: TenantAuthError = {
            type: "workspace_disabled",
            message: err.message,
          };
          return reply.status(403).send(disabledError);
        }
        if (err.statusCode === 403 && err.type === "email_not_verified") {
          const unverifiedError: TenantAuthError = {
            type: "email_not_verified",
            message: err.message,
          };
          return reply.status(403).send(unverifiedError);
        }
        throw error;
      }

      const invalidError: TenantAuthError = {
        type: "invalid_credentials",
        message: "Invalid email or password",
      };
      return reply.status(401).send(invalidError);
    });

    inner.post(
      "/onboard",
      { preHandler: [authenticatePlatform, requirePlatformPermission("onboard")] },
      async (request, reply) => {
        const parsed = parseRequest(onboardBodySchema, request.body);
        if (!parsed.ok) return replyValidationError(reply, parsed.message);
        const body = parsed.data;
        const { platformUser } = request as PlatformAuthenticatedRequest;

        const passwordOk = await verifyPlatformUserPassword(platformUser.id, body.currentPassword);
        if (!passwordOk) {
          return reply.status(401).send({
            type: "invalid_current_password",
            message: "Current password is incorrect",
          });
        }

        try {
          const result = await onboardUser({
            email: body.email,
            adminName: body.adminName,
            password: body.password,
            subdomain: body.subdomain,
            madrasaName: body.madrasaName,
            tagline: body.tagline,
            country: body.country,
            primaryColor: body.primaryColor,
            secondaryColor: body.secondaryColor,
            logoUrl: body.logoUrl,
            adminPhone: body.adminPhone,
            website: body.website,
            footerText: body.footerText,
            faviconUrl: body.faviconUrl,
            legalName: body.legalName,
            registrationNumber: body.registrationNumber,
            addressLine1: body.addressLine1,
            addressLine2: body.addressLine2,
            city: body.city,
            region: body.region,
            postalCode: body.postalCode,
            socialLinks: body.socialLinks,
            modules: body.modules,
            industryType: body.industryType,
          });
          await insertPlatformActivityLog({
            userId: platformUser.id,
            userEmail: platformUser.email,
            action: "onboard_workspace",
            targetResource: "workspace",
            targetId: body.subdomain,
            metadataMessage: `Onboarded workspace ${body.madrasaName}`,
            ipAddress: request.ip,
          });
          return reply.send(result);
        } catch (error: unknown) {
          const err = error as Error & { statusCode?: number };
          const statusCode = err.statusCode ?? 500;
          return reply.status(statusCode).send({
            type: statusCode === 409 ? "conflict" : "server_error",
            message: err.message || "Onboarding failed",
          });
        }
      },
    );

    inner.post("/2fa/verify", async (request, reply) => {
      const parsed = parseRequest(challengeCodeBodySchema, request.body ?? {});
      if (!parsed.ok) return replyValidationError(reply, parsed.message);
      const { challengeId, code } = parsed.data;
      const result = await completeTwoFactorLogin(challengeId, code, fastify.jwt, reply);
      if (!result) {
        const error: TenantAuthError = {
          type: "invalid_credentials",
          message: "Invalid or expired verification code",
        };
        return reply.status(401).send(error);
      }
      const payload: TenantLoginResponse = { user: result.user, requires2FA: false };
      return reply.send(payload);
    });

    inner.post("/2fa/resend", async (request, reply) => {
      const parsed = parseRequest(challengeIdBodySchema, request.body ?? {});
      if (!parsed.ok) return replyValidationError(reply, parsed.message);
      const { challengeId } = parsed.data;
      const ok = await resendTwoFactorChallenge(challengeId);
      if (!ok) {
        return sendNotFound(reply, "Challenge not found or expired");
      }
      return reply.send({ success: true });
    });
  });
};
