import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {} from "../deps.js";
import { issuePlatformSession } from "../services/platformAuthService.js";
import { platformSessionScope, touchSession } from "../deps.js";
import { platformSessionPolicy } from "../deps.js";
import {
  toPublicPlatformUser,
  getPlatformUserProfile,
  getStoredPlatformUserById,
  changePlatformUserPassword as updatePlatformUserPassword,
  updatePlatformUserProfile,
} from "../services/platformUserService.js";
import { platformChangePasswordBodySchema, platformProfilePatchBodySchema } from "@mms/contracts";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { insertPlatformActivityLog } from "../use-cases/platformUseCases.js";
import { clearPlatformAccessCookie } from "../services/platformCookieService.js";

export async function handlePlatformMe(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { platformUser } = request as any;
  if (!platformUser) {
    clearPlatformAccessCookie(reply);
    return reply.send({ user: null, isAuthenticated: false });
  }
  const profile = await getPlatformUserProfile(platformUser.id);
  if (!profile) {
    clearPlatformAccessCookie(reply);
    return reply.send({ user: null, isAuthenticated: false });
  }
  return reply.send({ user: profile, isAuthenticated: true });
}

export async function handlePlatformSessionExtend(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { platformUser } = request as any;
  const { idleMs } = platformSessionPolicy();
  await touchSession(platformSessionScope(platformUser.id), idleMs, true);
  return reply.send({ ok: true, idleMs });
}

export async function handlePlatformUpdateMe(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const parsed = parseRequest(platformProfilePatchBodySchema, request.body);
  if (!parsed.ok) return replyValidationError(reply, parsed.message);
  const { platformUser } = request as any;
  const profile = await updatePlatformUserProfile(platformUser.id, parsed.data);
  const stored = await getStoredPlatformUserById(profile.id);
  await issuePlatformSession(
    {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      permissions: profile.permissions,
    },
    fastify.jwt,
    reply,
    stored?.sessionVersion ?? 0,
  );
  return reply.send({ user: profile });
}

export async function handlePlatformChangePassword(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const parsed = parseRequest(platformChangePasswordBodySchema, request.body);
  if (!parsed.ok) return replyValidationError(reply, parsed.message);
  const { platformUser } = request as any;
  const stored = await updatePlatformUserPassword(
    platformUser.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  await issuePlatformSession(
    toPublicPlatformUser(stored),
    fastify.jwt,
    reply,
    stored.sessionVersion,
  );
  await insertPlatformActivityLog({
    userId: platformUser.id,
    userEmail: platformUser.email,
    action: "change_password",
    targetResource: "platform_user",
    targetId: platformUser.id,
    ipAddress: request.ip,
  });
  return reply.send({ success: true });
}
