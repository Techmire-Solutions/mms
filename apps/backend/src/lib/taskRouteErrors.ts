import { HttpDomainError } from "./httpErrors.js";

/**
 * Stable HTTP mapping for Tasks domain failures (mms-api-interface §3 error
 * taxonomy): validation → 400, delegation/permission → 403, archive state →
 * 409. Anything else is an infrastructure failure and must stay a 500 rather
 * than being masked as a client or conflict error.
 */
export type TaskRouteErrorResponse =
  | { status: 400; body: { type: "validation_error"; message: string } }
  | { status: 403; body: { type: "forbidden"; message: string } }
  | { status: 409; body: { type: "conflict"; message: string } };

export function mapTaskRouteError(error: unknown): TaskRouteErrorResponse | null {
  if (!(error instanceof HttpDomainError)) return null;
  if (error.statusCode === 400) {
    return { status: 400, body: { type: "validation_error", message: error.message } };
  }
  if (error.statusCode === 403) {
    return { status: 403, body: { type: "forbidden", message: error.message } };
  }
  if (error.statusCode === 409) {
    return { status: 409, body: { type: "conflict", message: error.message } };
  }
  return null;
}
