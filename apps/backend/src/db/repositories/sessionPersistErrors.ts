import { ConflictError } from "../../lib/httpErrors.js";
import { isExclusionViolation } from "../../lib/pgErrors.js";

/**
 * The exclusion constraint is the authority (migration 0206); translate its `23P01` into a 409 so
 * callers that bypass the use-case guard (imports, rollover, lifecycle ops) still get an
 * actionable message instead of a database error.
 */
export function throwOverlapConflict(error: unknown): never {
  if (isExclusionViolation(error)) {
    throw new ConflictError(
      'These dates overlap another live session. Close or archive it first, or enable "Allow overlapping sessions" in Sessions → Setup → Preferences.',
    );
  }
  throw error;
}
