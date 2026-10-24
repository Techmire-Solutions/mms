import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { issuePlatformSession } from "../../services/platform/platformAuthService.js";
import { startPlatformSetup } from "../../services/platform/platformSetupService.js";
import { toPublicPlatformUser } from "../../services/platform/platformUserService.js";
import {
  completePlatformPasswordReset,
  requestPlatformPasswordReset,
  resendPlatformPasswordReset,
} from "../../services/platform/platformPasswordResetService.js";
import {
  platformPasswordForgotBodySchema,
  platformPasswordResendBodySchema,
  platformPasswordResetBodySchema,
  platformSetupRegisterBodySchema,
} from "@mms/shared";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";

export async function handlePlatformSetupRegister(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const parsed = parseRequest(platformSetupRegisterBodySchema, request.body);
  if (!parsed.ok) return replyValidationError(reply, parsed.message);

  const stored = await startPlatformSetup(parsed.data);
  const user = await issuePlatformSession(
    toPublicPlatformUser(stored),
    fastify.jwt,
    reply,
    stored.sessionVersion,
  );
  return reply.send({ user });
}

export async function handlePlatformPasswordForgot(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const parsed = parseRequest(platformPasswordForgotBodySchema, request.body);
  if (!parsed.ok) return replyValidationError(reply, parsed.message);

  const result = await requestPlatformPasswordReset(parsed.data.email);
  return reply.send(result);
}

export async function handlePlatformPasswordReset(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const parsed = parseRequest(platformPasswordResetBodySchema, request.body);
  if (!parsed.ok) return replyValidationError(reply, parsed.message);
  const { resetId, code, password } = parsed.data;

  const stored = await completePlatformPasswordReset(resetId, code, password);
  const user = await issuePlatformSession(
    toPublicPlatformUser(stored),
    fastify.jwt,
    reply,
    stored.sessionVersion,
  );
  return reply.send({ user });
}

export async function handlePlatformPasswordResend(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const parsed = parseRequest(platformPasswordResendBodySchema, request.body);
  if (!parsed.ok) return replyValidationError(reply, parsed.message);

  const result = await resendPlatformPasswordReset(parsed.data.resetId);
  return reply.send(result);
}
