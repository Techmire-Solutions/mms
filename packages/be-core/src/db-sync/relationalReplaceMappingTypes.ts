export interface RelationalCollectionMapping {
  /** Restore order: lower runs first (unmapped defaults to 100). FK-safe ordering. */
  priority?: number;
  importPath: string;
  /** Repository helper that wipes and reinserts every workspace row (admin restore). */
  fnName: string;
  /**
   * Repository helper that lists every workspace row for admin backup snapshots.
   * Omit to keep a table out of backups — the audit trail must never be rolled back by a restore.
   */
  snapshotFnName?: string;
}
