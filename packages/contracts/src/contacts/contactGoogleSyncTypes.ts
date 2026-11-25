/** Google Contacts sync client contracts. */

/** Client configuration model for Google Contacts OAuth and synchronization. */
export interface ContactGoogleSyncConfigClient {
  clientId?: string;
  clientSecret?: string;
  clearTokens?: boolean;
  updatedAt?: string;
  hasClientSecret?: boolean;
  hasRefreshToken?: boolean;
  isConnected?: boolean;
}

/** Result snapshot returned when running a Google Contacts sync operation. */
export interface GoogleContactsSyncRunResult {
  total: number;
  imported: number;
  /** Number of existing contacts enriched or updated with new data from Google. */
  updated?: number;
  /** Total skipped = skippedName + skippedUnique. */
  skipped: number;
  /** Skipped because an active contact already has the same name or was unchanged. */
  skippedName: number;
  /** Skipped because a Setup-unique field collided with an active peer. */
  skippedUnique: number;
}
