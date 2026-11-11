/** The SQLSTATE behind a driver error, walking the `cause` chain. */
export function pgErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return String((error as { code: string }).code);
  }
  const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  return pgErrorCode(cause);
}

/**
 * Postgres error probes shared across services. `isUniqueViolation` walks nested
 * `cause` chains because pg wraps driver errors, hiding the `23505` code.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "23505") return true;
  const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  return isUniqueViolation(cause);
}

/**
 * The constraint/index name behind a `23505`, or null.
 *
 * Needed because a table can have several unique indexes and the caller must
 * answer differently ("already enrolled" vs "roll number already used"). Walks
 * the `cause` chain for the same reason as {@link isUniqueViolation}.
 */
export function uniqueViolationConstraint(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if (
    "code" in error &&
    String((error as { code?: unknown }).code ?? "") === "23505" &&
    "constraint" in error &&
    typeof (error as { constraint?: unknown }).constraint === "string"
  ) {
    return (error as { constraint: string }).constraint;
  }
  const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  return uniqueViolationConstraint(cause);
}

/** True for `23503` (foreign_key_violation), including wrapped driver errors. */
export function isForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "23503") return true;
  const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  return isForeignKeyViolation(cause);
}

/** True for `23P01` (exclusion_violation), including wrapped driver errors. */
export function isExclusionViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "23P01") return true;
  const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  return isExclusionViolation(cause);
}
