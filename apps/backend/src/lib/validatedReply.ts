import type { FastifyReply } from "fastify";
import type { ZodType } from "zod";
import { logger } from "./logger.js";

/**
 * Sends a hand-built response only after it satisfies its declared schema.
 *
 * The hand-written finance/accounting routes assemble their payloads from
 * use-case results, so without this a mapper regression (a non-canonical decimal
 * like `281.0000000000`, a leaked audit column, a missing key) would ship silently
 * — the same failure mode ts-rest `responseValidation` prevents on the contract
 * routes. A payload that breaks the contract is a server bug: log it with the
 * request id and answer 500 `contract_violation`, never the malformed body.
 */
export function sendValidated<T>(
  reply: FastifyReply,
  status: 200 | 201,
  schema: ZodType<T>,
  payload: unknown,
): FastifyReply {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    logger.error(
      { err: parsed.error, issues: parsed.error.issues, url: reply.request.url },
      "Route response failed its declared schema",
    );
    return reply.status(500).send({
      type: "contract_violation",
      message: "The server produced a response that does not match its API contract",
      requestId: reply.request.id,
    });
  }
  return reply.status(status).send(parsed.data);
}
