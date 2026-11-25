/** Aggregate counts + formatted size from a completed workspace export. */
export interface WorkspaceExportStats {
  collections: number;
  objects: number;
  size: string;
}

export interface UseBackupRestoreOptions {
  subdomain: string | null | undefined;
  adminEmail: string;
}
