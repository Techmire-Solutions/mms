import { reportClientError } from "../reporting/clientErrorReporting.js";

/** Fire-and-forget audit mutation; report failures without blocking the primary UX. */
export function safeAudit(promise: Promise<unknown>, scope: string): void {
  void promise.catch((auditError) => {
    reportClientError(auditError, { scope });
  });
}
