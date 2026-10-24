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

/** True for `23503` (foreign_key_violation), including wrapped driver errors. */
export function isForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "23503") return true;
  const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  return isForeignKeyViolation(cause);
}
