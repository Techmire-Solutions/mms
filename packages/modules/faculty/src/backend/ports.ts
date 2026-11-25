/**
 * App-bound ports for the faculty module.
 *
 * The module may not import another module or an app, so the contacts
 * reconciliation helpers and the CSV-export job runner are bound by the
 * composition root (`apps/api/src/modules/faculty/adapters.ts`).
 */
export interface FacultyContactsPort {
  reconcileFacultyContactsByFacultyIds(...args: any[]): Promise<any>;
  reconcileContactSystemTags(...args: any[]): Promise<any>;
  reconcileDesignationContacts(...args: any[]): Promise<any>;
  loadContactsSummaryByIdsForTenant(...args: any[]): Promise<any>;
}

export interface FacultyCsvExportOptions {
  columns?: any;
  filename?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface FacultyCsvExportRunnerOptions {
  moduleId: string;
  kind?: string;
  entityNounPlural: string;
  buildExport: (
    query: Record<string, unknown>,
    options: FacultyCsvExportOptions,
    tenant?: string,
    signal?: AbortSignal,
  ) => Promise<{ csv: string; filename: string; count: number }>;
  generateStreamChunks?: (
    query: Record<string, unknown>,
    options: FacultyCsvExportOptions,
    tenant?: string,
  ) => AsyncGenerator<unknown, { count: number; filename: string }, undefined>;
}

/** Users/IAM surface the faculty domain reads or writes during role sync. */
export interface FacultyUsersPort {
  findTenantUserRowByContactId(...args: any[]): Promise<any>;
  upsertTenantUserRow(...args: any[]): Promise<any>;
  listAllTenantUsersByWorkspace(...args: any[]): Promise<any>;
  getTenantUsersSettings(...args: any[]): Promise<any>;
  resolveCurrentTenantRole(...args: any[]): any;
  tenantUserHasPermission(...args: any[]): any;
  getUserModulePreferencesByWorkspace(...args: any[]): Promise<any>;
  upsertUserModulePreferences(...args: any[]): Promise<any>;
  invalidateTenantRbac(...args: any[]): Promise<any>;
}

export interface FacultyPorts extends FacultyContactsPort, FacultyUsersPort {
  registerModuleCsvExportJobRunner(options: FacultyCsvExportRunnerOptions): void;
}
