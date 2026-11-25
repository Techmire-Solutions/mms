import { describe, expect, it, vi } from "vitest";
import {
  fetchAttendanceLookups,
  putAttendanceLookupKind,
  useAttendanceLookupsQuery,
  useAttendanceLookupMutation,
} from "./useAttendanceLookups";

vi.mock("@mms/fe-core/api/tsRest", () => ({
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

vi.mock("@mms/fe-core/lib/createModuleLookupsHooks", () => ({
  createModuleLookupsHooks: () => ({
    useLookupsQuery: () => ({ data: {}, isLoading: false }),
    useLookupMutation: () => ({ mutateAsync: vi.fn() }),
  }),
}));

describe("useAttendanceLookups Hook suite", () => {
  it("fetches and updates lookup items", async () => {
    const lookups = await fetchAttendanceLookups();
    expect(lookups.statuses).toEqual([{ id: "present", label: "Present" }]);

    const updated = await putAttendanceLookupKind("statuses" as unknown as never, [
      { id: "present", label: "Present" } as unknown as never,
    ]);
    expect(updated).toEqual([{ id: "present", label: "Present" }]);
  });

  it("exports lookups query and mutation hooks", () => {
    expect(typeof useAttendanceLookupsQuery).toBe("function");
    expect(typeof useAttendanceLookupMutation).toBe("function");
  });
});
