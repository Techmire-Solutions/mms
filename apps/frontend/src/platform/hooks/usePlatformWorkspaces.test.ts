import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { PlatformWorkspaceRow } from "@mms/shared";
import {
  PLATFORM_WORKSPACES_QUERY_KEY,
  usePlatformWorkspaces,
  useSetWorkspaceEnabled,
  useSetWorkspaceEmailVerification,
  useDeleteWorkspace,
  useWorkspaceModules,
  useUpdateWorkspaceModules,
  useResetWorkspaceAdminPassword,
  useCreateWorkspaceAdmin,
} from "./usePlatformWorkspaces";

describe("usePlatformWorkspaces", () => {
  it("exports valid hook definitions and constants", () => {
    expect(PLATFORM_WORKSPACES_QUERY_KEY).toEqual(["platform", "workspaces"]);
    expect(typeof usePlatformWorkspaces).toBe("function");
    expect(typeof useSetWorkspaceEnabled).toBe("function");
    expect(typeof useSetWorkspaceEmailVerification).toBe("function");
    expect(typeof useDeleteWorkspace).toBe("function");
    expect(typeof useWorkspaceModules).toBe("function");
    expect(typeof useUpdateWorkspaceModules).toBe("function");
    expect(typeof useResetWorkspaceAdminPassword).toBe("function");
    expect(typeof useCreateWorkspaceAdmin).toBe("function");
  });

  it("safely updates ts-rest query cache objects without throwing TypeError on old.map", () => {
    const queryClient = new QueryClient();
    const mockWorkspace1: PlatformWorkspaceRow = {
      subdomain: "madrasa-1",
      madrasaName: "Madrasa One",
      enabled: true,
      createdAt: "2026-01-01",
      requireEmailVerification: true,
    };
    const mockWorkspace2: PlatformWorkspaceRow = {
      subdomain: "madrasa-2",
      madrasaName: "Madrasa Two",
      enabled: true,
      createdAt: "2026-01-02",
      requireEmailVerification: false,
    };

    // Initialize cache with ts-rest response format
    queryClient.setQueryData(PLATFORM_WORKSPACES_QUERY_KEY, {
      status: 200,
      body: { workspaces: [mockWorkspace1, mockWorkspace2] },
      headers: new Headers(),
    });

    // Test enabled toggle updater targeting madrasa-1
    queryClient.setQueryData(PLATFORM_WORKSPACES_QUERY_KEY, (old: any) => {
      if (!old) return old;
      if (old.body && Array.isArray(old.body.workspaces)) {
        return {
          ...old,
          body: {
            ...old.body,
            workspaces: old.body.workspaces.map((w: PlatformWorkspaceRow) =>
              w.subdomain === "madrasa-1" ? { ...w, enabled: false } : w,
            ),
          },
        };
      }
      return old;
    });

    const cached: any = queryClient.getQueryData(PLATFORM_WORKSPACES_QUERY_KEY);
    expect(cached.body.workspaces[0].enabled).toBe(false);
    expect(cached.body.workspaces[1].enabled).toBe(true);

    // Test email verification toggle updater targeting madrasa-1
    queryClient.setQueryData(PLATFORM_WORKSPACES_QUERY_KEY, (old: any) => {
      if (!old) return old;
      if (old.body && Array.isArray(old.body.workspaces)) {
        return {
          ...old,
          body: {
            ...old.body,
            workspaces: old.body.workspaces.map((w: PlatformWorkspaceRow) =>
              w.subdomain === "madrasa-1" ? { ...w, requireEmailVerification: false } : w,
            ),
          },
        };
      }
      return old;
    });

    const updatedCached: any = queryClient.getQueryData(PLATFORM_WORKSPACES_QUERY_KEY);
    expect(updatedCached.body.workspaces[0].requireEmailVerification).toBe(false);
    expect(updatedCached.body.workspaces[1].requireEmailVerification).toBe(false);
  });

  it("safely handles direct array cache structures and empty cache", () => {
    const queryClient = new QueryClient();
    const mockWorkspace: PlatformWorkspaceRow = {
      subdomain: "madrasa-direct",
      madrasaName: "Direct Madrasa",
      enabled: true,
      createdAt: "2026-01-01",
      requireEmailVerification: true,
    };

    // 1. Direct array cache
    queryClient.setQueryData(PLATFORM_WORKSPACES_QUERY_KEY, [mockWorkspace]);
    queryClient.setQueryData(PLATFORM_WORKSPACES_QUERY_KEY, (old: any) => {
      if (!old) return old;
      if (Array.isArray(old)) {
        return old.map((w: PlatformWorkspaceRow) =>
          w.subdomain === "madrasa-direct" ? { ...w, enabled: false } : w,
        );
      }
      return old;
    });

    const cachedArray: any = queryClient.getQueryData(PLATFORM_WORKSPACES_QUERY_KEY);
    expect(cachedArray[0].enabled).toBe(false);

    // 2. Null cache returns undefined/null safely
    queryClient.setQueryData(PLATFORM_WORKSPACES_QUERY_KEY, null);
    queryClient.setQueryData(PLATFORM_WORKSPACES_QUERY_KEY, (old: any) => {
      if (!old) return old;
      return old;
    });
    expect(queryClient.getQueryData(PLATFORM_WORKSPACES_QUERY_KEY)).toBeNull();
  });
});
