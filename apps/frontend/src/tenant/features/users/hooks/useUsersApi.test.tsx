import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { extractActivityLogs, useUsersByIds, useUsersMutations } from "./useUsersApi";
import { invalidateUsersQueries } from "./invalidateUsersQueries";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}));

vi.mock("@/lib/api", () => ({
  tsrClient: {
    users: {
      list: { useQuery: (...args: any[]) => mockUseQuery(...args) },
      activity: { useQuery: (...args: any[]) => mockUseQuery(...args) },
      create: { useMutation: (opts: any) => mockUseMutation("create", opts) },
      update: { useMutation: (opts: any) => mockUseMutation("update", opts) },
      invite: { useMutation: (opts: any) => mockUseMutation("invite", opts) },
      bulkUpdate: { useMutation: (opts: any) => mockUseMutation("bulkUpdate", opts) },
      activityBulkUpdate: {
        useMutation: (opts: any) => mockUseMutation("activityBulkUpdate", opts),
      },
      delete: { useMutation: (opts: any) => mockUseMutation("delete", opts) },
      restore: { useMutation: (opts: any) => mockUseMutation("restore", opts) },
      bulkDelete: { useMutation: (opts: any) => mockUseMutation("bulkDelete", opts) },
      bulkRestore: { useMutation: (opts: any) => mockUseMutation("bulkRestore", opts) },
      resetPassword: { useMutation: (opts: any) => mockUseMutation("resetPassword", opts) },
      exportAudit: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }) },
    },
  },
}));

vi.mock("./invalidateUsersQueries", () => ({
  invalidateUsersQueries: vi.fn(),
}));

function renderTestHook<T>(hookFn: () => T): { result: { current: T }; unmount: () => void } {
  const result = { current: null as unknown as T };
  function TestComponent() {
    result.current = hookFn();
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(<TestComponent />);
  });
  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("useUsersApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractActivityLogs", () => {
    it("handles direct arrays, enveloped objects, and non-200 responses", () => {
      const logs = [{ id: "l1", action: "create", timestamp: "2026-09-01" }];
      expect(extractActivityLogs(logs as any)).toEqual(logs);
      expect(extractActivityLogs({ status: 200, body: { logs } })).toEqual(logs);
      expect(extractActivityLogs({ status: 200, body: logs })).toEqual(logs);
      expect(extractActivityLogs({ status: 500, body: { logs } })).toEqual([]);
      expect(extractActivityLogs(null)).toEqual([]);
      expect(extractActivityLogs(undefined)).toEqual([]);
    });
  });

  describe("useUsersByIds", () => {
    it("requests and normalizes only the referenced users", () => {
      mockUseQuery.mockReturnValue({
        data: {
          status: 200,
          body: [{ id: "u1", name: "Alice", email: "alice@test.com", role: "admin" }],
        },
      });

      const { result, unmount } = renderTestHook(() => useUsersByIds(["u1", "u1"]));
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0]?.name).toBe("Alice");
      expect(result.current.data[0]?.role).toBe("admin");
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryData: {
            query: {
              ids: "u1",
              page: 1,
              limit: 1,
            },
          },
        }),
      );
      unmount();
    });

    it("returns an empty data array when query data is errored", () => {
      mockUseQuery.mockReturnValue({ data: { status: 500, body: null } });
      const { result, unmount } = renderTestHook(() => useUsersByIds(["u1"]));
      expect(result.current.data).toEqual([]);
      unmount();
    });
  });

  describe("useUsersMutations", () => {
    it("wires invalidation and unboxes mutation responses", async () => {
      let capturedCreateOpts: any;
      const mockCreateMutateAsync = vi.fn().mockResolvedValue({
        status: 200,
        body: { user: { id: "u-created", name: "Created User" } },
      });

      mockUseMutation.mockImplementation((key, opts) => {
        if (key === "create") {
          capturedCreateOpts = opts;
          return { mutateAsync: mockCreateMutateAsync, mutate: vi.fn() };
        }
        return {
          mutateAsync: vi.fn().mockResolvedValue({ status: 200, body: {} }),
          mutate: vi.fn(),
        };
      });

      const { result, unmount } = renderTestHook(() => useUsersMutations());

      const created = await result.current.createUser.mutateAsync({ name: "Created User" });
      expect(created).toEqual({ id: "u-created", name: "Created User" });

      capturedCreateOpts.onSuccess();
      expect(invalidateUsersQueries).toHaveBeenCalled();

      unmount();
    });
  });
});
