import type { FastifyReply } from "fastify";
import type { IamErrorCode } from "../shared/errors.js";
import { isIamError } from "../shared/errors.js";

const STATUS: Record<IamErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

/**
 * Single HTTP mapping for IAM failures. Unknown errors fall back to 400 rather
 * than leaking a stack or a DB message through a 500.
 */
export function sendIamError(reply: FastifyReply, error: unknown): FastifyReply {
  if (isIamError(error)) {
    return reply.status(STATUS[error.code]).send({ type: error.code, message: error.message });
  }
  const message = error instanceof Error ? error.message : "IAM operation failed";
  return reply.status(400).send({ type: "bad_request", message });
}
