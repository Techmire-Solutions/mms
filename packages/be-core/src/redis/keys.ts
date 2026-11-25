/**
 * Centralized Redis cache keys and pub/sub channel names (SSOT).
 */
export const redisKeys = {
  workspace: (subdomain: string) => `mms:workspace:${subdomain.trim().toLowerCase()}`,
  globalSettings: (tenant: string) => `mms:${tenant.trim().toLowerCase()}:global_settings`,
  userActive: (tenant: string, userId: string, role: string) =>
    `mms:${tenant.trim().toLowerCase()}:user_active:${userId}:${role}`,
  userActivePattern: (userId: string) => `mms:*:user_active:${userId}:*`,
  sessionPattern: (userId: string) => `mms:session:${userId}:*`,
  setupSingleton: (tenant: string, tableName: string, jsonColumn: string) =>
    `mms:${tenant.trim().toLowerCase()}:setup:${tableName}:${jsonColumn}`,
  setupLookupsAll: (tenant: string, tableName: string) =>
    `mms:${tenant.trim().toLowerCase()}:setup:${tableName}:all`,
  setupLookupsKind: (tenant: string, tableName: string, kind: string) =>
    `mms:${tenant.trim().toLowerCase()}:setup:${tableName}:kind:${kind}`,
  setupPattern: (tenant: string, tableName: string) =>
    `mms:${tenant.trim().toLowerCase()}:setup:${tableName}:*`,
  metrics: (tenant: string, collection: string) =>
    `mms:${tenant.trim().toLowerCase()}:${collection}:metrics`,
  metricsPattern: (tenant: string, collection: string) =>
    `mms:${tenant.trim().toLowerCase()}:${collection}*:metrics`,
  dashboardSummary: (tenant: string, date?: string) =>
    `mms:${tenant.trim().toLowerCase()}:dashboard:summary:${date ?? "today"}`,
  dashboardSummaryPattern: (tenant: string) =>
    `mms:${tenant.trim().toLowerCase()}:dashboard:summary:*`,
  searchVersion: (tenant: string, entityType: string, entityId: string) =>
    `mms:${tenant.trim().toLowerCase()}:search:version:${entityType}:${entityId}`,
  entityPattern: (tenant: string, entityType: string) =>
    `mms:${tenant.trim().toLowerCase()}:${entityType}:*`,
  wsInvalidationChannel: "mms:ws-invalidation" as const,
  jobEventChannel: "mms:job-event" as const,
};
