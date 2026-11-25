import { ConflictError } from "@mms/be-core/http/errors";
import { isExclusionViolation } from "@mms/be-core/http/errors";

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
