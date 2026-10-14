/**
 * Single Source of Truth (SSOT) TanStack Query keys for the Platform Apex domain.
 */
export const PLATFORM_QUERY_KEYS = {
  workspaces: ["platform", "workspaces"] as const,
  workspaceList: (params: Record<string, string | number | undefined>) =>
    ["platform", "workspaces", "list", params] as const,
  workspaceMetrics: ["platform", "workspaces", "metrics"] as const,
  workspaceModules: (subdomain: string) => ["platform", "workspace-modules", subdomain] as const,
  workspaceRegistry: ["platform", "workspace-registry"] as const,
  admins: ["platform", "admins"] as const,
  activityLogs: ["platform", "activity-logs"] as const,
  settings: ["platform", "settings"] as const,
  health: ["platform", "health"] as const,
  profile: ["platform", "profile"] as const,
  setupStatus: ["platform", "setup", "status"] as const,
  erd: ["platform", "schema", "erd"] as const,
} as const;

export const PLATFORM_WORKSPACES_QUERY_KEY = PLATFORM_QUERY_KEYS.workspaces;
export const PLATFORM_WORKSPACE_METRICS_QUERY_KEY = PLATFORM_QUERY_KEYS.workspaceMetrics;
export const PLATFORM_ADMINS_QUERY_KEY = PLATFORM_QUERY_KEYS.admins;
export const PLATFORM_ACTIVITY_LOGS_QUERY_KEY = PLATFORM_QUERY_KEYS.activityLogs;
export const PLATFORM_SETTINGS_QUERY_KEY = PLATFORM_QUERY_KEYS.settings;
export const PLATFORM_SETUP_STATUS_QUERY_KEY = PLATFORM_QUERY_KEYS.setupStatus;
export const WORKSPACE_REGISTRY_QUERY_KEY = PLATFORM_QUERY_KEYS.workspaceRegistry;
export const PLATFORM_PROFILE_QUERY_KEY = PLATFORM_QUERY_KEYS.profile;
