import { describe, expect, it, vi } from "vitest";
import {
  useAttendanceContractList,
  useAttendanceContractCreate,
  useAttendanceContractBulk,
  useAttendanceContractBulkDelete,
  useAttendanceContractBulkRestore,
  useAttendanceContractUpdate,
  useAttendanceContractDelete,
} from "./useAttendance";

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
    attendance: {
      list: { useQuery: () => ({ data: {}, isLoading: false }) },
      create: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      bulk: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      bulkDelete: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      bulkRestore: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      update: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      delete: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
}));

describe("useAttendanceContractHooks suite", () => {
  it("exports contract hooks for list, create, bulk, delete, restore, update", () => {
    expect(useAttendanceContractList).toBeDefined();
    expect(useAttendanceContractCreate).toBeDefined();
    expect(useAttendanceContractBulk).toBeDefined();
    expect(useAttendanceContractBulkDelete).toBeDefined();
    expect(useAttendanceContractBulkRestore).toBeDefined();
    expect(useAttendanceContractUpdate).toBeDefined();
    expect(useAttendanceContractDelete).toBeDefined();
  });
});
