import type { FastifyReply } from "fastify";

/** Canonical auth response envelopes shared by the tenant and platform guards. */
export function sendForbidden(
  reply: FastifyReply,
  message = "Insufficient permissions",
): FastifyReply {
  return reply.status(403).send({ type: "forbidden", message });
}

export function sendUnauthorized(
  reply: FastifyReply,
  message = "Authentication is required",
  type = "auth_required",
): FastifyReply {
  return reply.status(401).send({ type, message });
}

export function sendServiceUnavailable(
  reply: FastifyReply,
  message = "Service unavailable",
): FastifyReply {
  return reply.status(503).send({ type: "service_unavailable", message });
}

export function sendWorkspaceDisabled(reply: FastifyReply): FastifyReply {
  return reply.status(403).send({
    type: "workspace_disabled",
    message: "This madrasa workspace has been disabled by the platform administrator.",
  });
}

export function sendTwoFactorRequired(reply: FastifyReply): FastifyReply {
  return reply.status(403).send({
    type: "two_factor_required",
    message: "Two-factor authentication is required to access this resource",
  });
}
