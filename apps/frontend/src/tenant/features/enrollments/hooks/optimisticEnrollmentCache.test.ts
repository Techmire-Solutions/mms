import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  patchEnrollmentStatuses,
  rollbackEnrollmentSnapshots,
  type OptimisticEndContext,
} from "./optimisticEnrollmentCache";

describe("optimistic enrollment cache", () => {
  it("patches contract envelopes, bare pages, arrays and detail records", () => {
    const ids = new Set(["e1"]);
    expect(
      patchEnrollmentStatuses(
        { status: 200, body: { enrollments: [{ id: "e1", status: "confirmed" }, { id: "e2" }] } },
        ids,
        "withdrawn",
      ),
    ).toEqual({
      status: 200,
      body: { enrollments: [{ id: "e1", status: "withdrawn" }, { id: "e2" }] },
    });
    expect(patchEnrollmentStatuses([{ id: "e1", status: "confirmed" }], ids, "cancelled")).toEqual([
      { id: "e1", status: "cancelled" },
    ]);
    expect(patchEnrollmentStatuses({ id: "e1", status: "confirmed" }, ids, "withdrawn")).toEqual({
      id: "e1",
      status: "withdrawn",
    });
    expect(patchEnrollmentStatuses({ enrollments: [{ id: "e1" }] }, ids, "withdrawn")).toEqual({
      enrollments: [{ id: "e1", status: "withdrawn" }],
    });
    expect(patchEnrollmentStatuses("unchanged", ids, "withdrawn")).toBe("unchanged");
  });

  it("restores every snapshot on rollback", () => {
    const setQueryData = vi.fn();
    const queryClient = { setQueryData } as unknown as QueryClient;
    const context: OptimisticEndContext = {
      snapshots: [
        [["enrollments", "list"], { enrollments: [] }],
        [["enrollments", "list", "detail", "e1"], { id: "e1", status: "confirmed" }],
      ],
    };
    rollbackEnrollmentSnapshots(queryClient, context);
    expect(setQueryData).toHaveBeenCalledTimes(2);
    expect(setQueryData).toHaveBeenCalledWith(["enrollments", "list"], { enrollments: [] });
  });
});
