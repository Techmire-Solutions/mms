/**
 * Idempotency key lifecycle for a server CSV export attempt.
 *
 * The key doubles as the background-job id server-side (`enqueueCsvExportJob`), so it
 * decides whether a repeat click dedupes onto the existing job:
 *
 * - **Ambiguous outcome** (poll timed out → the POST may or may not have landed):
 *   keep the key, so the retry returns the in-flight/finished job instead of queueing a
 *   second export of the same scope.
 * - **Definite failure** (enqueue rejected, or the job failed): rotate the key, otherwise
 *   the retry would dedupe onto the failed job and could never succeed.
 * - **Success**: rotate the key so the next export is a genuinely new job.
 *
 * A changed scope/filter signature always rotates: it is a different export.
 */
export interface CsvExportAttempt {
  readonly key: string;
  readonly signature: string;
}

/** Returns the retained attempt for the same signature, else a fresh one. */
export function nextCsvExportAttempt(
  previous: CsvExportAttempt | null,
  signature: string,
  createKey: () => string = () => crypto.randomUUID(),
): CsvExportAttempt {
  if (previous && previous.signature === signature) return previous;
  return { key: createKey(), signature };
}

/** Stable fingerprint of what is being exported (scope + filters/selection). */
export function csvExportAttemptSignature(scope: string, payload: unknown): string {
  return `${scope}:${stableStringify(payload)}`;
}

/** Order-insensitive JSON for small query objects (filter maps, id lists). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "";
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
