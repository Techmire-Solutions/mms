import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  useUsersContractList,
  useUsersContractCreate,
  useUsersContractUpdate,
  useUsersContractInvite,
  useUsersContractBulkUpdate,
  useUsersContractBulkDelete,
  useUsersContractBulkRestore,
  useUsersContractDelete,
  useUsersContractRestore,
  useUsersContractVerifyEmail,
} from "./useUsersQueries";
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

vi.mock("@/lib/api", () => ({
  tsrClient: {
    users: {
      list: { useQuery: (...args: unknown[]) => mockUseQuery(...args) },
      create: { useMutation: (opts: unknown) => mockUseMutation("create", opts) },
      update: { useMutation: (opts: unknown) => mockUseMutation("update", opts) },
      invite: { useMutation: (opts: unknown) => mockUseMutation("invite", opts) },
      bulkUpdate: { useMutation: (opts: unknown) => mockUseMutation("bulkUpdate", opts) },
      bulkDelete: { useMutation: (opts: unknown) => mockUseMutation("bulkDelete", opts) },
      bulkRestore: { useMutation: (opts: unknown) => mockUseMutation("bulkRestore", opts) },
      delete: { useMutation: (opts: unknown) => mockUseMutation("delete", opts) },
      restore: { useMutation: (opts: unknown) => mockUseMutation("restore", opts) },
      verifyEmail: { useMutation: (opts: unknown) => mockUseMutation("verifyEmail", opts) },
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

describe("useUsersContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures useUsersContractList with query params", () => {
    mockUseQuery.mockReturnValue({ data: { status: 200, body: [] } });
    const { result, unmount } = renderTestHook(() => useUsersContractList({ search: "test" }));

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryData: { query: { search: "test" } },
        staleTime: 15_000,
        enabled: true,
      }),
    );
    expect(result.current.data.status).toBe(200);
    unmount();
  });

  it("binds query cache invalidation for all user mutations", () => {
    const mutations = [
      { hook: useUsersContractCreate, key: "create" },
      { hook: useUsersContractUpdate, key: "update" },
      { hook: useUsersContractInvite, key: "invite" },
      { hook: useUsersContractBulkUpdate, key: "bulkUpdate" },
      { hook: useUsersContractBulkDelete, key: "bulkDelete" },
      { hook: useUsersContractBulkRestore, key: "bulkRestore" },
      { hook: useUsersContractDelete, key: "delete" },
      { hook: useUsersContractRestore, key: "restore" },
      { hook: useUsersContractVerifyEmail, key: "verifyEmail" },
    ];

    for (const { hook, key } of mutations) {
      let capturedOpts!: { onSuccess: () => void };
      mockUseMutation.mockImplementationOnce((mutationKey, opts) => {
        expect(mutationKey).toBe(key);
        capturedOpts = opts;
        return { mutate: vi.fn() };
      });

      const { unmount } = renderTestHook(() => hook());

      expect(typeof capturedOpts?.onSuccess).toBe("function");
      capturedOpts.onSuccess();
      expect(invalidateUsersQueries).toHaveBeenCalled();
      unmount();
    }
  });
});
