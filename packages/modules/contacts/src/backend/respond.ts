import type { FastifyReply } from "fastify";
import type { ContactsErrorCode } from "../shared/errors.js";
import { isContactsError } from "../shared/errors.js";

const STATUS: Record<ContactsErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

/**
 * Single HTTP mapping for contacts failures. Unknown errors fall back to 400
 * rather than leaking a stack or a DB message through a 500.
 */
export function sendContactsError(reply: FastifyReply, error: unknown): FastifyReply {
  if (isContactsError(error)) {
    return reply.status(STATUS[error.code]).send({ type: error.code, message: error.message });
  }
  const message = error instanceof Error ? error.message : "Contacts operation failed";
  return reply.status(400).send({ type: "bad_request", message });
}
