import { pgErrorMessage, pgErrorCode } from "./pgErrors.js";

/** The shared `{ type, message }` envelope, plus optional structured context. */
export interface ErrorEnvelopeBody {
  type: string;
  message: string;
  /** Machine-readable reasons carried by domain errors (e.g. blocked transitions). */
  violations?: string[];
  /** Structured context (blocked students, transition endpoints, OCC token). */
  details?: Record<string, unknown>;
}

/**
 * Maps a PostgreSQL constraint failure to the status it actually is, instead of reporting every
 * database rejection as a 500. The exam paths rely on this: the marks-bounds trigger (`23514`), a
 * FK (`23503`), an oversized `varchar` (`22001`), a `numeric` overflow (`22003`) and the natural-key
 * unique index (`23505`) are all client-correctable, not server faults.
 */
export interface DatabaseConstraintResponse {
  status: number;
  type: string;
}

const PG_CONSTRAINT_RESPONSES: Record<string, DatabaseConstraintResponse> = {
  "23505": { status: 409, type: "conflict" },
  "23503": { status: 409, type: "reference_conflict" },
  "23514": { status: 400, type: "constraint_violation" },
  "22001": { status: 400, type: "value_too_long" },
  "22003": { status: 400, type: "value_out_of_range" },
  "22P02": { status: 400, type: "invalid_value" },
  // Invalid datetime format / datetime field overflow: a malformed date string
  // that reached a `date` column (report/list filters validate now, this is the
  // defence for any future path).
  "22007": { status: 400, type: "invalid_value" },
  "22008": { status: 400, type: "invalid_value" },
  // Exclusion violation (fiscal-year non-overlap, migration 0251).
  "23P01": { status: 409, type: "conflict" },
};

/**
 * Fragments of the ledger guards' own messages (migrations 0248/0249 and the
 * posting-period guard). A check violation carrying one of these is a deliberate
 * domain rejection with a reason the caller can act on — not an anonymous
 * constraint failure. Matched case-insensitively on the driver message.
 */
const LEDGER_GUARD_FRAGMENTS = [
  "posted journal entry",
  "closed posting period",
  "is unbalanced",
  "has a zero total",
  "must have at least two lines",
] as const;

/** The ledger guard's own message when this error came from one, else null. */
export function ledgerGuardMessage(error: unknown): string | null {
  const message = pgErrorMessage(error);
  if (!message) return null;
  const lower = message.toLowerCase();
  return LEDGER_GUARD_FRAGMENTS.some((fragment) => lower.includes(fragment)) ? message : null;
}

/** The client-correctable status/type for a PostgreSQL constraint code, if recognised. */
export function mapDatabaseErrorCode(
  code: string | undefined | null,
): DatabaseConstraintResponse | undefined {
  return code ? PG_CONSTRAINT_RESPONSES[code] : undefined;
}

/**
 * Maps a raw PostgreSQL constraint failure to the shared envelope.
 *
 * Contract/gate handlers run outside the generic route factories, so without this they report
 * `23505`/`23514`/`22003` as a 500. The route-specific message is not available here; a generic,
 * non-leaking message is used instead.
 */
export function mapConstraintError(
  error: unknown,
): { status: number; body: ErrorEnvelopeBody } | null {
  const code = pgErrorCode(error);
  const guard = code === "23514" ? ledgerGuardMessage(error) : null;
  if (guard) {
    return { status: 422, body: { type: "ledger_guard", message: guard } };
  }
  const mapped = mapDatabaseErrorCode(code);
  if (!mapped) return null;
  return {
    status: mapped.status,
    body: {
      type: mapped.type,
      message:
        mapped.status === 409
          ? "The request conflicts with the stored data"
          : "The request was rejected by a data constraint",
    },
  };
}
