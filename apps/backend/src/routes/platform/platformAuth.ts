import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  authenticatePlatform,
  optionalAuthenticatePlatform,
  requireMainDomain,
} from "../../middleware/authenticatePlatform.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import { getPlatformSetupStatus } from "../../services/platform/platformSetupService.js";
import { platformSessionPolicy } from "../../services/sessionPolicyService.js";
import {
  handlePlatformSetupRegister,
  handlePlatformPasswordForgot,
  handlePlatformPasswordReset,
  handlePlatformPasswordResend,
} from "./platformRecoveryHandlers.js";
import {
  handlePlatformLogin,
  handlePlatform2FAVerify,
  handlePlatform2FAResend,
  handlePlatformLogout,
} from "./platformAuthHandlers.js";
import {
  handlePlatformMe,
  handlePlatformSessionExtend,
  handlePlatformUpdateMe,
  handlePlatformChangePassword,
} from "./platformProfileHandlers.js";

export default async function platformAuthRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", requireMainDomain);

  fastify.get("/setup/status", async (_request, reply) => {
    return reply.send(await getPlatformSetupStatus());
  });

  await fastify.register(async function platformSetupRateLimited(inner) {
    inner.addHook("preHandler", createStrictRateLimitGuard(inner, AUTH_RATE_LIMIT));
    inner.post("/setup/register", (req, rep) => handlePlatformSetupRegister(fastify, req, rep));
  });

  await fastify.register(async function platformPasswordResetRateLimited(inner) {
    inner.addHook("preHandler", createStrictRateLimitGuard(inner, AUTH_RATE_LIMIT));
    inner.post("/password/forgot", handlePlatformPasswordForgot);
    inner.post("/password/reset", (req, rep) => handlePlatformPasswordReset(fastify, req, rep));
    inner.post("/password/resend", handlePlatformPasswordResend);
  });

  await fastify.register(async function platformAuthRateLimited(inner) {
    inner.addHook("preHandler", createStrictRateLimitGuard(inner, AUTH_RATE_LIMIT));
    inner.post("/login", (req, rep) => handlePlatformLogin(fastify, req, rep));
    inner.post("/2fa/verify", (req, rep) => handlePlatform2FAVerify(fastify, req, rep));
    inner.post("/2fa/resend", handlePlatform2FAResend);
  });

  fastify.post("/logout", (req, rep) => handlePlatformLogout(fastify, req, rep));

  fastify.get("/me", { preHandler: optionalAuthenticatePlatform }, handlePlatformMe);

  fastify.get("/session/policy", async (_request, reply) => {
    return reply.send(platformSessionPolicy());
  });

  fastify.post(
    "/session/extend",
    { preHandler: authenticatePlatform },
    handlePlatformSessionExtend,
  );

  fastify.patch("/me", { preHandler: authenticatePlatform }, (req, rep) =>
    handlePlatformUpdateMe(fastify, req, rep),
  );

  await fastify.register(async function platformChangePasswordRateLimited(inner) {
    inner.addHook("preHandler", createStrictRateLimitGuard(inner, AUTH_RATE_LIMIT));
    inner.post("/change-password", { preHandler: authenticatePlatform }, (req, rep) =>
      handlePlatformChangePassword(fastify, req, rep),
    );
  });
}
