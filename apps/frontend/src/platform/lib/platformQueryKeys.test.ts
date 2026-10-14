import { describe, expect, it } from "vitest";
import {
  PLATFORM_QUERY_KEYS,
  PLATFORM_WORKSPACES_QUERY_KEY,
  PLATFORM_ADMINS_QUERY_KEY,
  PLATFORM_ACTIVITY_LOGS_QUERY_KEY,
  PLATFORM_SETTINGS_QUERY_KEY,
  PLATFORM_SETUP_STATUS_QUERY_KEY,
  WORKSPACE_REGISTRY_QUERY_KEY,
  PLATFORM_PROFILE_QUERY_KEY,
} from "./platformQueryKeys";

describe("platformQueryKeys SSOT", () => {
  it("defines stable query key tuples for all platform entities", () => {
    expect(PLATFORM_QUERY_KEYS.workspaces).toEqual(["platform", "workspaces"]);
    expect(PLATFORM_QUERY_KEYS.workspaceMetrics).toEqual(["platform", "workspaces", "metrics"]);
    expect(
      PLATFORM_QUERY_KEYS.workspaceList({
        page: 2,
        limit: 25,
        search: "dar",
        status: "active",
        sortField: "name",
        sortDir: "asc",
      }),
    ).toEqual([
      "platform",
      "workspaces",
      "list",
      {
        page: 2,
        limit: 25,
        search: "dar",
        status: "active",
        sortField: "name",
        sortDir: "asc",
      },
    ]);
    expect(PLATFORM_QUERY_KEYS.admins).toEqual(["platform", "admins"]);
    expect(PLATFORM_QUERY_KEYS.activityLogs).toEqual(["platform", "activity-logs"]);
    expect(PLATFORM_QUERY_KEYS.settings).toEqual(["platform", "settings"]);
    expect(PLATFORM_QUERY_KEYS.health).toEqual(["platform", "health"]);
    expect(PLATFORM_QUERY_KEYS.profile).toEqual(["platform", "profile"]);
    expect(PLATFORM_QUERY_KEYS.setupStatus).toEqual(["platform", "setup", "status"]);
    expect(PLATFORM_QUERY_KEYS.erd).toEqual(["platform", "schema", "erd"]);
    expect(PLATFORM_QUERY_KEYS.workspaceRegistry).toEqual(["platform", "workspace-registry"]);
  });

  it("generates parameterized query keys for workspace modules", () => {
    expect(PLATFORM_QUERY_KEYS.workspaceModules("darululoom")).toEqual([
      "platform",
      "workspace-modules",
      "darululoom",
    ]);
  });

  it("maintains backwards-compatible named constant aliases", () => {
    expect(PLATFORM_WORKSPACES_QUERY_KEY).toBe(PLATFORM_QUERY_KEYS.workspaces);
    expect(PLATFORM_ADMINS_QUERY_KEY).toBe(PLATFORM_QUERY_KEYS.admins);
    expect(PLATFORM_ACTIVITY_LOGS_QUERY_KEY).toBe(PLATFORM_QUERY_KEYS.activityLogs);
    expect(PLATFORM_SETTINGS_QUERY_KEY).toBe(PLATFORM_QUERY_KEYS.settings);
    expect(PLATFORM_SETUP_STATUS_QUERY_KEY).toBe(PLATFORM_QUERY_KEYS.setupStatus);
    expect(WORKSPACE_REGISTRY_QUERY_KEY).toBe(PLATFORM_QUERY_KEYS.workspaceRegistry);
    expect(PLATFORM_PROFILE_QUERY_KEY).toBe(PLATFORM_QUERY_KEYS.profile);
  });
});
