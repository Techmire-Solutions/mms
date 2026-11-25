/** Result of comparing a backup's source subdomain against the restore target. */
export type BackupSubdomainCompare = "match" | "mismatch" | "unidentified";

/**
 * Compares a backup's source subdomain against the target tenant after trim +
 * case normalization. Returns 'unidentified' when either side is missing,
 * 'mismatch' when both are present but differ, 'match' when equal.
 */
export function compareBackupSubdomains(
  source: string | null | undefined,
  target: string | null | undefined,
): BackupSubdomainCompare {
  const a = source?.trim().toLowerCase();
  const b = target?.trim().toLowerCase();
  if (!a || !b) return "unidentified";
  return a === b ? "match" : "mismatch";
}
