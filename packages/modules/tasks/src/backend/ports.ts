/**
 * App-bound ports for the tasks module.
 *
 * Notifications/messaging/users/faculty/contacts and background-job plumbing stay
 * in the app; the composition root binds them in
 * `apps/api/src/modules/tasks/adapters.ts`.
 */
export interface TasksNotificationsPort {
  notificationsUseCases: any;
}

export interface TasksMessagingPort {
  messagingUseCases: any;
  dispatchMessagingCampaignDirect(...args: any[]): Promise<any>;
}

export interface TasksUsersPort {
  usersUseCases: any;
  getTenantUsersSettings(...args: any[]): Promise<any>;
  getTenantRoleCatalog(...args: any[]): Promise<any>;
  tenantUserHasPermission(...args: any[]): Promise<boolean>;
}

export interface TasksDirectoryPort {
  findFacultyByIds(...args: any[]): Promise<any>;
  loadContactsSummaryByIdsForTenant(...args: any[]): Promise<any>;
  lockFacultyHierarchy(...args: any[]): Promise<any>;
}

export interface TasksJobsPort {
  enqueueCsvExportJob(...args: any[]): Promise<any>;
  normalizeExportQuery(...args: any[]): any;
  enqueueBackgroundJob(...args: any[]): Promise<any>;
  getUserBackgroundJob(...args: any[]): Promise<any>;
  getUserBackgroundJobPayload(...args: any[]): Promise<any>;
  retryFailedBackgroundJob(...args: any[]): Promise<any>;
  hasBackgroundJobRunner(jobId: string): boolean;
  isBackgroundJobLimitError(error: unknown): boolean;
  isQueueUnavailableError(error: unknown): boolean;
  registerModuleCsvExportJobRunner(options: Record<string, unknown>): void;
}

export interface TasksPorts
  extends
    TasksNotificationsPort,
    TasksMessagingPort,
    TasksUsersPort,
    TasksDirectoryPort,
    TasksJobsPort {}
