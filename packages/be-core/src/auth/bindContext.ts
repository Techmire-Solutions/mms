import type { FastifyRequest } from "fastify";
import { bindRequestAuditContext, bindRequestUserId } from "@mms/db/request-context";
import { formatTraceParent, type SpanContext } from "../telemetry/index.js";

export interface BoundUser {
  id?: string | number;
  jti?: string;
}

/**
 * Binds the verified user/audit context (correlation id, IP, client app, session
 * id, endpoint, method) after a successful tenant authentication.
 */
export function bindAuthenticatedRequestContext(
  request: FastifyRequest,
  user: BoundUser,
  telemetrySpan?: { context: SpanContext },
): void {
  bindRequestUserId(user.id ? String(user.id) : null);
  const traceparent =
    (telemetrySpan ? formatTraceParent(telemetrySpan.context) : null) ||
    (typeof request.headers["traceparent"] === "string"
      ? request.headers["traceparent"].trim()
      : null) ||
    undefined;

  bindRequestAuditContext({
    correlationId: traceparent,
    ipAddress: request.ip,
    clientApp:
      typeof request.headers["user-agent"] === "string"
        ? request.headers["user-agent"].slice(0, 64)
        : undefined,
    sessionId: user.jti,
    apiEndpoint: request.url,
    httpMethod: request.method,
  });
}
