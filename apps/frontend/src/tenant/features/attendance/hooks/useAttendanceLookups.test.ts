import { describe, expect, it, vi } from "vitest";
import {
  fetchAttendanceLookups,
  putAttendanceLookupKind,
  useAttendanceLookupsQuery,
  useAttendanceLookupMutation,
} from "./useAttendanceLookups";

vi.mock("@/lib/api", () => ({
  apiContract: {
    attendance: {
      getLookups: vi.fn().mockResolvedValue({
        body: {
          lookups: {
            statuses: [{ id: "present", label: "Present" }],
          },
        },
      }),
      updateLookupKind: vi.fn().mockResolvedValue({
        body: {
          items: [{ id: "present", label: "Present" }],
        },
      }),
    },
  },
}));

vi.mock("@/lib/query/createModuleLookupsHooks", () => ({
  createModuleLookupsHooks: () => ({
    useLookupsQuery: () => ({ data: {}, isLoading: false }),
    useLookupMutation: () => ({ mutateAsync: vi.fn() }),
  }),
}));

describe("useAttendanceLookups Hook suite", () => {
  it("fetches and updates lookup items", async () => {
    const lookups = await fetchAttendanceLookups();
    expect(lookups.statuses).toBeDefined();

    const updated = await putAttendanceLookupKind("statuses" as any, [
      { id: "present", label: "Present" } as any,
    ]);
    expect(updated).toBeDefined();
  });

  it("exports lookups query and mutation hooks", () => {
    expect(useAttendanceLookupsQuery).toBeDefined();
    expect(useAttendanceLookupMutation).toBeDefined();
  });
});
