import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/test/queryClientTestUtils";

const mocks = vi.hoisted(() => {
  const options: Record<string, { onSuccess?: (...args: unknown[]) => void }> = {};
  const hookReturns: Record<string, unknown> = {};
  return {
    options,
    hookReturns,
    listUseQuery: vi.fn(),
    contractList: vi.fn(),
    invalidateStudents: vi.fn(),
    invalidateBulkEnroll: vi.fn(),
  };
});

vi.mock("@/lib/api", () => {
  const mutation = (name: string) => ({
    useMutation: (opts: { onSuccess?: (...args: unknown[]) => void }) => {
      mocks.options[name] = opts;
      const returned = { mutateAsync: vi.fn(), isPending: false, name };
      mocks.hookReturns[name] = returned;
      return returned;
    },
  });
  return {
    tsrClient: {
      students: {
        list: { useQuery: (...args: unknown[]) => mocks.listUseQuery(...args) },
        create: mutation("create"),
        update: mutation("update"),
        delete: mutation("delete"),
        bulkStatus: mutation("bulkStatus"),
        bulkEnroll: mutation("bulkEnroll"),
        duplicateCheck: mutation("duplicateCheck"),
        restore: mutation("restore"),
        bulkDelete: mutation("bulkDelete"),
        bulkRestore: mutation("bulkRestore"),
        setupAudit: mutation("setupAudit"),
      },
    },
    apiContract: {
      students: { list: (...args: unknown[]) => mocks.contractList(...args) },
    },
  };
});

vi.mock("@/tenant/features/students/hooks/invalidateStudentsQueries", () => ({
  invalidateStudentsQueries: (...args: unknown[]) => mocks.invalidateStudents(...args),
  invalidateStudentsBulkEnrollQueries: (...args: unknown[]) => mocks.invalidateBulkEnroll(...args),
}));

import {
  studentsListQueryOptions,
  useStudentsContractBulkDelete,
  useStudentsContractBulkEnroll,
  useStudentsContractBulkRestore,
  useStudentsContractBulkStatus,
  useStudentsContractCreate,
  useStudentsContractDelete,
  useStudentsContractDuplicateCheck,
  useStudentsContractList,
  useStudentsContractLogSetupAudit,
  useStudentsContractRestore,
  useStudentsContractUpdate,
} from "@/tenant/features/students/hooks/useStudentsQueries";
import { studentsListQueryKey } from "@/tenant/features/students/hooks/studentsQueryKeys";

describe("students contract query hooks", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderHook<TRender>(hook: () => TRender): TRender {
    let captured!: TRender;
    function TestComponent() {
      captured = hook();
      return null;
    }
    act(() => {
      root.render(withQueryClient(<TestComponent />, createTestQueryClient()));
    });
    return captured;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("builds the canonical list key and returns the contract envelope", async () => {
    const response = { status: 200, body: { students: [], total: 0, page: 1, limit: 50 } };
    mocks.contractList.mockResolvedValue(response);

    const options = studentsListQueryOptions({ page: 2, search: "ali" });

    expect(options.queryKey).toEqual(studentsListQueryKey({ page: 2, search: "ali" }));
    expect(options.staleTime).toBe(15_000);
    await expect(
      options.queryFn!({ signal: new AbortController().signal } as never),
    ).resolves.toEqual(response);
    expect(mocks.contractList).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: 2, search: "ali" } }),
    );
  });

  it("throws when the list contract answers with an error status", async () => {
    mocks.contractList.mockResolvedValue({ status: 500, body: { message: "boom" } });
    const options = studentsListQueryOptions({});

    await expect(
      options.queryFn!({ signal: new AbortController().signal } as never),
    ).rejects.toMatchObject({ status: 500 });
  });

  it("wires the ts-rest list hook to the same key with 15s staleness", () => {
    mocks.listUseQuery.mockReturnValue({ data: undefined });
    renderHook(() => useStudentsContractList({ page: 1, limit: 25 }));

    expect(mocks.listUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: studentsListQueryKey({ page: 1, limit: 25 }),
        queryData: { query: { page: 1, limit: 25 } },
        staleTime: 15_000,
        enabled: true,
      }),
    );
  });

  it.each([
    ["create", useStudentsContractCreate],
    ["update", useStudentsContractUpdate],
    ["delete", useStudentsContractDelete],
    ["bulkStatus", useStudentsContractBulkStatus],
    ["restore", useStudentsContractRestore],
    ["bulkDelete", useStudentsContractBulkDelete],
    ["bulkRestore", useStudentsContractBulkRestore],
  ])("invalidates students after a successful %s", (name, hook) => {
    renderHook(hook as () => unknown);

    const options = mocks.options[name as string];
    expect(options).toBeDefined();
    act(() => {
      options?.onSuccess?.({}, undefined, undefined);
    });
    expect(mocks.invalidateStudents).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateBulkEnroll).not.toHaveBeenCalled();
  });

  it("invalidates enrollments and sessions after a bulk enrollment", () => {
    renderHook(() => useStudentsContractBulkEnroll());

    act(() => {
      mocks.options.bulkEnroll?.onSuccess?.({}, undefined, undefined);
    });

    expect(mocks.invalidateBulkEnroll).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateStudents).not.toHaveBeenCalled();
  });

  it("leaves the duplicate-check and setup-audit mutations without cache side effects", () => {
    renderHook(() => useStudentsContractDuplicateCheck());
    renderHook(() => useStudentsContractLogSetupAudit());

    expect(mocks.options.duplicateCheck?.onSuccess).toBeUndefined();
    expect(mocks.options.setupAudit?.onSuccess).toBeUndefined();
    expect(mocks.invalidateStudents).not.toHaveBeenCalled();
  });
});
