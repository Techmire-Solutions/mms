import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { extractActivityLogs, useUsersByIds, useUsersMutations } from "./useUsersApi";
import { invalidateUsersQueries } from "./invalidateUsersQueries";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const { mockUsersList } = vi.hoisted(() => ({ mockUsersList: vi.fn() }));

vi.mock("@/lib/api", () => ({
  tsrClient: {
    users: {
      list: { useQuery: (...args: unknown[]) => mockUseQuery(...args) },
      activity: { useQuery: (...args: unknown[]) => mockUseQuery(...args) },
      create: { useMutation: (opts: unknown) => mockUseMutation("create", opts) },
      update: { useMutation: (opts: unknown) => mockUseMutation("update", opts) },
      invite: { useMutation: (opts: unknown) => mockUseMutation("invite", opts) },
      bulkUpdate: { useMutation: (opts: unknown) => mockUseMutation("bulkUpdate", opts) },
      activityBulkUpdate: {
        useMutation: (opts: unknown) => mockUseMutation("activityBulkUpdate", opts),
      },
      delete: { useMutation: (opts: unknown) => mockUseMutation("delete", opts) },
      restore: { useMutation: (opts: unknown) => mockUseMutation("restore", opts) },
      bulkDelete: { useMutation: (opts: unknown) => mockUseMutation("bulkDelete", opts) },
      bulkRestore: { useMutation: (opts: unknown) => mockUseMutation("bulkRestore", opts) },
      resetPassword: { useMutation: (opts: unknown) => mockUseMutation("resetPassword", opts) },
      exportAudit: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }) },
    },
  },
  apiContract: {
    users: {
      list: (...args: unknown[]) => mockUsersList(...args),
    },
  },
}));

vi.mock("./invalidateUsersQueries", () => ({
  invalidateUsersQueries: vi.fn(),
}));

async function renderTestHook<T>(
  hookFn: () => T,
): Promise<{ result: { current: T }; unmount: () => void }> {
  const result = { current: null as unknown as T };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function TestComponent() {
    result.current = hookFn();
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <TestComponent />
      </QueryClientProvider>,
    );
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
      expect(extractActivityLogs(logs as unknown as never)).toEqual(logs);
      expect(extractActivityLogs({ status: 200, body: { logs } })).toEqual(logs);
      expect(extractActivityLogs({ status: 200, body: logs })).toEqual(logs);
      expect(extractActivityLogs({ status: 500, body: { logs } })).toEqual([]);
      expect(extractActivityLogs(null)).toEqual([]);
      expect(extractActivityLogs(undefined)).toEqual([]);
    });
  });

  describe("useUsersByIds", () => {
    beforeEach(() => {
      mockUsersList.mockReset();
    });

    it("fetches in maxPageSize chunks and merges every resolved user", async () => {
      const ids = Array.from({ length: 250 }, (_, index) => `u${index}`);
      mockUsersList.mockImplementation(
        async (args: { query: { ids: string } }): Promise<unknown> => {
          const chunkIds = args.query.ids.split(",");
          return {
            status: 200,
            body: {
              users: chunkIds.map((id) => ({
                id,
                name: `User ${id}`,
                email: `${id}@test.com`,
                role: "teacher",
              })),
              total: chunkIds.length,
              page: 1,
              limit: chunkIds.length,
              hasMore: false,
            },
          };
        },
      );

      const { result, unmount } = await renderTestHook(() => useUsersByIds(ids));

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.data).toHaveLength(250);
        });
      });
      expect(mockUsersList).toHaveBeenCalledTimes(3);
      const chunkSizes = mockUsersList.mock.calls.map(
        (call) => (call[0] as { query: { ids: string } }).query.ids.split(",").length,
      );
      expect(chunkSizes).toEqual([100, 100, 50]);
      expect(result.current.data.map((user) => user.id)).toEqual([...ids].sort());
      expect(result.current.data[0]?.name).toBe("User u0");
      unmount();
    });

    it("passes the query signal to every chunk request", async () => {
      mockUsersList.mockResolvedValue({
        status: 200,
        body: { users: [], total: 0, page: 1, limit: 0, hasMore: false },
      });

      const { unmount } = await renderTestHook(() => useUsersByIds(["u1"]));

      await act(async () => {
        await vi.waitFor(() => {
          expect(mockUsersList).toHaveBeenCalledTimes(1);
        });
      });
      const firstCall = mockUsersList.mock.calls[0]?.[0] as { signal?: unknown };
      expect(firstCall.signal).toBeInstanceOf(AbortSignal);
      unmount();
    });

    it("returns an empty data array when query data is errored", async () => {
      mockUsersList.mockResolvedValue({ status: 500, body: null });

      const { result, unmount } = await renderTestHook(() => useUsersByIds(["u1"]));

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.data).toEqual([]);
        });
      });
      unmount();
    });
  });

  describe("useUsersMutations", () => {
    it("wires invalidation and unboxes mutation responses", async () => {
      let capturedCreateOpts!: { onSuccess: () => void };
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

      const { result, unmount } = await renderTestHook(() => useUsersMutations());

      const created = await result.current.createUser.mutateAsync({ name: "Created User" });
      expect(created).toEqual({ id: "u-created", name: "Created User" });

      capturedCreateOpts.onSuccess();
      expect(invalidateUsersQueries).toHaveBeenCalled();

      unmount();
    });
  });
});
