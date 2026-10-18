import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  issuePlatformSession,
  loginPlatformUser,
  logoutPlatformUser,
  type PlatformAccessTokenPayload,
} from "../../services/platform/platformAuthService.js";
import { PLATFORM_ACCESS_COOKIE } from "../../services/platform/platformCookieService.js";
import { revokeToken } from "../../services/authSessionService.js";
import {
  verifyPlatformTwoFactorChallenge,
  resendPlatformTwoFactorChallenge,
} from "../../services/platform/platformTwoFactorService.js";
import { toPublicPlatformUser } from "../../services/platform/platformUserService.js";
import {
  loginBodySchema as platformLoginBodySchema,
  challengeCodeBodySchema,
  challengeIdBodySchema,
  type PlatformLoginResponse,
} from "@mms/shared";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";

export async function handlePlatformLogin(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const parsed = parseRequest(platformLoginBodySchema, request.body);
  if (!parsed.ok) return replyValidationError(reply, parsed.message);
  const { email, password } = parsed.data;
  const result = await loginPlatformUser(email, password, fastify.jwt, reply);
  if (!result.ok) {
    if (result.type === "account_disabled") {
      return reply.status(401).send({
        type: "account_disabled",
        message: "Platform account has been disabled",
      });
    }
    if (result.type === "two_factor_unavailable") {
      return reply.status(503).send({
        type: "two_factor_unavailable",
        message:
          "Two-factor verification is required but the code could not be sent. Check platform email configuration.",
      });
    }
    return reply.status(401).send({
      type: "invalid_credentials",
      message: "Invalid platform credentials",
    });
  }
  if (result.requires2FA) {
    const payload: PlatformLoginResponse = {
      user: result.user,
      requires2FA: true,
      challengeId: result.challengeId,
    };
    return reply.send(payload);
  }
  const payload: PlatformLoginResponse = { user: result.user };
  return reply.send(payload);
}

export async function handlePlatform2FAVerify(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const parsed = parseRequest(challengeCodeBodySchema, request.body ?? {});
  if (!parsed.ok) return replyValidationError(reply, parsed.message);
  const { challengeId, code } = parsed.data;

  const stored = await verifyPlatformTwoFactorChallenge(challengeId, code);
  if (!stored) {
    return reply.status(401).send({
      type: "invalid_credentials",
      message: "Invalid or expired verification code",
    });
  }
  const user = await issuePlatformSession(
    toPublicPlatformUser(stored),
    fastify.jwt,
    reply,
    stored.sessionVersion,
  );
  return reply.send({ user });
}

export async function handlePlatform2FAResend(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const parsed = parseRequest(challengeIdBodySchema, request.body ?? {});
  if (!parsed.ok) return replyValidationError(reply, parsed.message);

  const result = await resendPlatformTwoFactorChallenge(parsed.data.challengeId);
  if (!result.ok) {
    return reply.status(404).send({
      type: "invalid_credentials",
      message: "Challenge not found or expired",
    });
  }
  return reply.send({ success: true });
}

export async function handlePlatformLogout(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const token = request.cookies?.[PLATFORM_ACCESS_COOKIE];
  if (token) {
    try {
      const decoded = fastify.jwt.decode(token) as PlatformAccessTokenPayload | null;
      if (decoded?.jti) await revokeToken(decoded.jti, 8 * 60 * 60 + 300);
    } catch {
      // Best effort — logout still clears cookies.
    }
  }
  logoutPlatformUser(reply);
  return reply.send({ success: true });
}
