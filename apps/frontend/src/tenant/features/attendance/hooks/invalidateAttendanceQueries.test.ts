import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateAttendanceQueries } from "./invalidateAttendanceQueries";

describe("invalidateAttendanceQueries utility", () => {
  it("invalidates all attendance query keys on queryClient", () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient;

    invalidateAttendanceQueries(queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
  });
});
