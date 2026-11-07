import { HttpDomainError } from "../../lib/httpErrors.js";

/** A completion workflow refused by a finalisation gate (attendance, exams, dues, staleness). */
export class CompletionBlockedError extends HttpDomainError {
  constructor(
    readonly violations: readonly string[],
    message = `Completion is not finalised yet: ${violations.join(", ")}`,
  ) {
    super(409, "completion_blocked", message);
    this.name = "CompletionBlockedError";
  }
}
