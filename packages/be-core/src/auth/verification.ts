import type { FastifyReply } from "fastify";
import { sendUnauthorized } from "./responses.js";

/** Minimal JWT-verifying request surface (Fastify `request.jwtVerify`). */
export interface JwtVerifiableRequest {
  jwtVerify(): Promise<void>;
}

/** Verifies the request JWT, writing a 401 when verification fails. */
export async function verifyJwtOrUnauthorized(
  request: JwtVerifiableRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await request.jwtVerify();
    return true;
  } catch {
    await sendUnauthorized(reply);
    return false;
  }
}
