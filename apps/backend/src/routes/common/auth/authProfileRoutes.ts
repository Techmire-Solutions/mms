import type { FastifyPluginAsync } from "fastify";
import { establishSession, type User } from "../../../services/auth/authService.js";
import {
  type Contact,
  changePasswordBodySchema,
  confirmLoginEmailChangeBodySchema,
  ownContactPatchBodySchema,
  requestLoginEmailChangeBodySchema,
  verifyPasswordBodySchema,
} from "@mms/shared";
import { AUTH_RATE_LIMIT } from "../../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../../lib/rateLimitGuard.js";
import { clearAuthCookies } from "../../../services/auth/authCookieService.js";
import { authenticateTenant } from "../../../middleware/authenticate.js";
import {
  getTenantUserProfile,
  updateOwnLinkedContact,
  changeTenantUserPassword,
  verifyUserPassword,
} from "../../../services/auth/userService.js";
import {
  confirmLoginEmailChange,
  requestLoginEmailChange,
} from "../../../services/auth/tenantLoginEmailService.js";
import { ContactUniqueFieldError } from "../../../services/contactService.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendNotFound } from "../../../lib/httpErrors.js";

/** Tenant profile, linked contact, password, and login-email routes. */
export const authProfileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/profile", { preHandler: authenticateTenant }, async (request, reply) => {
    const user = request.user as User;
    const profile = await getTenantUserProfile(user.id);
    if (!profile) {
      return sendNotFound(reply, "Profile not found");
    }
    return reply.send({ profile });
  });

  fastify.put("/me/contact", { preHandler: authenticateTenant }, async (request, reply) => {
    const user = request.user as User;
    const parsed = parseRequest(ownContactPatchBodySchema, request.body ?? {});
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const current = await getTenantUserProfile(user.id);
    if (!current?.contact) {
      return reply.status(400).send({
        type: "no_contact_link",
        message: "No linked contact for this account",
      });
    }

    try {
      const contact = await updateOwnLinkedContact(user.id, {
        ...current.contact,
        ...parsed.data,
        id: current.contact.id,
      } as Contact);
      if (!contact) {
        return sendNotFound(reply, "Contact not found");
      }
      return reply.send({ contact });
    } catch (error: unknown) {
      if (error instanceof ContactUniqueFieldError) {
        return replyValidationError(reply, error.message, { errors: error.errors });
      }
      const err = error as Error & { statusCode?: number; type?: string };
      return reply.status(err.statusCode ?? 500).send({
        type: err.type ?? "server_error",
        message: err.message,
      });
    }
  });

  await fastify.register(async function tenantProfileRateLimited(inner) {
    // Strict guard, not `inner.register(rateLimit, …)` — see rateLimitGuard.ts.
    inner.addHook("preHandler", createStrictRateLimitGuard(inner, AUTH_RATE_LIMIT));

    inner.post("/change-password", { preHandler: authenticateTenant }, async (request, reply) => {
      const user = request.user as User;
      const parsed = parseRequest(changePasswordBodySchema, request.body ?? {});
      if (!parsed.ok) return replyValidationError(reply, parsed.message);
      try {
        await changeTenantUserPassword(
          user.id,
          parsed.data.currentPassword,
          parsed.data.newPassword,
        );
        clearAuthCookies(reply);
        return reply.send({ success: true, requiresSignIn: true });
      } catch (error: unknown) {
        const err = error as Error & { statusCode?: number; type?: string };
        return reply.status(err.statusCode ?? 500).send({
          type: err.type ?? "server_error",
          message: err.message,
        });
      }
    });

    inner.post("/verify-password", { preHandler: authenticateTenant }, async (request, reply) => {
      const user = request.user as User;
      const parsed = parseRequest(verifyPasswordBodySchema, request.body ?? {});
      if (!parsed.ok) return replyValidationError(reply, parsed.message);
      const claimedEmail = parsed.data.email?.trim().toLowerCase();
      const sessionEmail = (user.loginEmail ?? user.email ?? "").trim().toLowerCase();
      if (claimedEmail && claimedEmail !== sessionEmail) {
        return reply.status(401).send({
          type: "invalid_credentials",
          message: "Password is incorrect",
        });
      }
      const valid = await verifyUserPassword(user.id, parsed.data.password);
      if (!valid) {
        return reply.status(401).send({
          type: "invalid_credentials",
          message: "Password is incorrect",
        });
      }
      return reply.send({ valid: true });
    });

    inner.post(
      "/login-email/request",
      { preHandler: authenticateTenant },
      async (request, reply) => {
        const user = request.user as User;
        const parsed = parseRequest(requestLoginEmailChangeBodySchema, request.body ?? {});
        if (!parsed.ok) return replyValidationError(reply, parsed.message);
        const result = await requestLoginEmailChange(
          user.id,
          parsed.data.newLoginEmail,
          parsed.data.currentPassword,
        );
        return reply.send({
          success: true,
          challengeId: result.challengeId,
          devCode: result.devCode,
        });
      },
    );

    inner.post(
      "/login-email/confirm",
      { preHandler: authenticateTenant },
      async (request, reply) => {
        const parsed = parseRequest(confirmLoginEmailChangeBodySchema, request.body ?? {});
        if (!parsed.ok) return replyValidationError(reply, parsed.message);
        const updated = await confirmLoginEmailChange(parsed.data.challengeId, parsed.data.code);
        if (!updated) {
          return sendNotFound(reply, "User not found");
        }
        await establishSession(updated, fastify.jwt, reply, true);
        return reply.send({ user: updated, success: true });
      },
    );
  });
};
