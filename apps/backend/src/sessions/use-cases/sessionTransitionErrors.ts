import { HttpDomainError } from "../../lib/httpErrors.js";

/**
 * A session transition refused by the lifecycle guards. The violating codes travel to the client so
 * the UI can point at the specific rule instead of a generic conflict.
 */
export class SessionTransitionBlockedError extends HttpDomainError {
  constructor(
    readonly violations: readonly string[],
    message = `This session cannot change to that state: ${violations.join(", ")}`,
  ) {
    super(409, "session_transition_blocked", message);
    this.name = "SessionTransitionBlockedError";
  }
}
