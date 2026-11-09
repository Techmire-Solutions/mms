import type { AttendanceBatchRowError } from "@mms/shared";
import { HttpDomainError } from "../../lib/httpErrors.js";

/**
 * A batch write refused because one or more rows failed a rule.
 *
 * The batch stays **atomic** — nothing is written — but every failing row is reported, which is the
 * difference between "student X on 2026-03-02 was changed" and "3 of your 120 rows are invalid". The
 * `violations`/`details` shape is what `handleContractError` forwards to the client.
 */
export class AttendanceBatchRejectedError extends HttpDomainError {
  readonly violations: readonly string[];
  declare readonly details: Record<string, unknown>;

  constructor(errors: readonly AttendanceBatchRowError[]) {
    const violations = [...new Set(errors.map((error) => error.code))];
    const summary = errors
      .slice(0, 5)
      .map((error) => `${error.studentId} ${error.date}: ${error.message}`)
      .join("; ");
    super(
      422,
      "attendance_batch_rejected",
      `${errors.length} of the submitted rows were rejected — ${summary}`,
      {
        details: {
          errors: errors.slice(0, 50),
          rejectedCount: errors.length,
        },
      },
    );
    this.violations = violations;
  }
}
