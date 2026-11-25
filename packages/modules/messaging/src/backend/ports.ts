/**
 * App-bound ports for the messaging module.
 *
 * Contacts reads, transport dispatch (SMS/email/WhatsApp), strict rate limiting
 * and the CSV-export job runner stay in the app; the composition root binds them
 * in `apps/api/src/modules/messaging/adapters.ts`.
 */
export interface MessagingContactsPort {
  loadContactsPageForTenant(...args: any[]): Promise<any>;
  loadContactsSummaryByIdsForTenant(...args: any[]): Promise<any>;
  loadContactFieldConfig(...args: any[]): Promise<any>;
}

export interface MessagingTransportPort {
  sendTenantSms(...args: any[]): Promise<any>;
  sendTenantWhatsApp(...args: any[]): Promise<any>;
  sendTenantEmail(...args: any[]): Promise<any>;
}

export interface MessagingRateLimitPort {
  /** Strict rate-limit pre-handler factory; the app binds the messaging limit config. */
  createStrictRateLimitGuard(scope: unknown): any;
}

export interface MessagingJobsPort {
  enqueueBackgroundJob(...args: any[]): Promise<any>;
  getUserBackgroundJob(...args: any[]): Promise<any>;
  getUserBackgroundJobPayload(...args: any[]): Promise<any>;
}

export interface MessagingAuthArtifactPort {
  authArtifactUserScopeKey(...args: any[]): string;
  authArtifactWorkspaceScopeKey(...args: any[]): string;
  deleteAuthArtifact(...args: any[]): Promise<any>;
  findAuthArtifactByLookupKey(...args: any[]): Promise<any>;
  tryClaimAuthArtifactByLookupKey(...args: any[]): Promise<any>;
  updateAuthArtifactPayload(...args: any[]): Promise<any>;
}

export interface MessagingPorts
  extends
    MessagingContactsPort,
    MessagingTransportPort,
    MessagingRateLimitPort,
    MessagingJobsPort,
    MessagingAuthArtifactPort {
  registerModuleCsvExportJobRunner(options: Record<string, unknown>): void;
}
