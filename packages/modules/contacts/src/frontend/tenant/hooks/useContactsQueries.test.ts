import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  contactsListQueryOptions,
  useContactsContractList,
  useContactPickerSearch,
  useContactPickerOption,
  useContactsContractRestore,
  useContactsContractBulkDelete,
  useContactsContractBulkRestore,
  useContactsContractFieldConfig,
  useContactsContractUpdateFieldConfig,
} from "./useContactsQueries.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const invalidateSpy = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateSpy,
    }),
  };
});

vi.mock("@mms/fe-core/auth/AuthContext", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useAuth: () => ({ isAuthenticated: true }),
}));

const mockList = vi.fn();

vi.mock("@mms/fe-core/api/tsRest", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  apiContract: {
    contacts: {
      list: (...args: unknown[]) => mockList(...args),
    },
  },
  tsrClient: {
    contacts: {
      list: {
        useQuery: vi.fn(() => ({ data: { body: [] }, isSuccess: true })),
      },
      picker: {
        search: {
          useQuery: vi.fn((opts) => ({ data: { body: { contacts: [] } }, isSuccess: true, opts })),
        },
        get: {
          useQuery: vi.fn(() => ({ data: { body: null }, isSuccess: true })),
        },
      },
      restore: {
        useMutation: vi.fn((config) => ({ mutate: vi.fn(), isPending: false, config })),
      },
      bulkDelete: {
        useMutation: vi.fn((config) => ({ mutate: vi.fn(), isPending: false, config })),
      },
      bulkRestore: {
        useMutation: vi.fn((config) => ({ mutate: vi.fn(), isPending: false, config })),
      },
      getFieldConfig: {
        useQuery: vi.fn(() => ({ data: { body: {} }, isSuccess: true })),
      },
      updateFieldConfig: {
        useMutation: vi.fn((config) => ({ mutate: vi.fn(), isPending: false, config })),
      },
    },
  },
}));

describe("useContactsQueries", () => {
  it("contactsListQueryOptions queries and resolves data", async () => {
    const opts = contactsListQueryOptions({ search: "Jane" });
    expect(opts.queryKey).toContain("contract-list");

    mockList.mockResolvedValueOnce({
      status: 200,
      body: { contacts: [{ id: "1" }], total: 1, hasMore: false, page: 1 },
    });
    const result = await (
      opts.queryFn as unknown as ({ signal }: { signal: AbortSignal }) => Promise<unknown>
    )({
      signal: new AbortController().signal,
    });
    expect(result).toEqual({
      status: 200,
      body: { contacts: [{ id: "1" }], total: 1, hasMore: false, page: 1 },
    });

    mockList.mockResolvedValueOnce({ status: 500, body: "Error" });
    await expect(
      (opts.queryFn as unknown as ({ signal }: { signal: AbortSignal }) => Promise<unknown>)({
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("Failed to fetch contacts");
  });

  it("executes hooks properly and triggers invalidation on mutations", async () => {
    let pickerSearchOpts: unknown;
    let restoreMutation: { config?: { onSuccess?: () => void } } | undefined;
    let bulkDeleteMutation: { config?: { onSuccess?: () => void } } | undefined;
    let bulkRestoreMutation: { config?: { onSuccess?: () => void } } | undefined;
    let updateFieldConfigMutation: { config?: { onSuccess?: () => void } } | undefined;

    function TestComponent(): React.JSX.Element {
      useContactsContractList({});
      const searchRes = useContactPickerSearch({ search: "test" });
      pickerSearchOpts = (searchRes as { opts?: unknown }).opts;
      useContactPickerOption("1");
      restoreMutation = useContactsContractRestore() as unknown as typeof restoreMutation;
      bulkDeleteMutation = useContactsContractBulkDelete() as unknown as typeof bulkDeleteMutation;
      bulkRestoreMutation =
        useContactsContractBulkRestore() as unknown as typeof bulkRestoreMutation;
      useContactsContractFieldConfig();
      updateFieldConfigMutation =
        useContactsContractUpdateFieldConfig() as unknown as typeof updateFieldConfigMutation;

      return React.createElement("div");
    }

    const root = createRoot(document.createElement("div"));
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(pickerSearchOpts).toMatchObject({
      queryData: { query: { search: "test" } },
      enabled: true,
      staleTime: 15_000,
    });
    restoreMutation?.config?.onSuccess?.();
    bulkDeleteMutation?.config?.onSuccess?.();
    bulkRestoreMutation?.config?.onSuccess?.();
    updateFieldConfigMutation?.config?.onSuccess?.();

    expect(invalidateSpy).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});
