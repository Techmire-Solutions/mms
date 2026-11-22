/**
 * Faculty lookups transport contract: the shared lookups factory hands the
 * query's AbortSignal to `fetchLookups`, so the adapter must forward it to the
 * API transport instead of dropping it (dropped signals keep requests alive
 * after unmount/refetch).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const getLookups = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  apiContract: {
    faculty: {
      getLookups: (...args: unknown[]) => getLookups(...args),
    },
  },
}));

import { fetchFacultyLookups } from "./useFacultyLookups";

describe("fetchFacultyLookups", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes the query abort signal through to the API transport", async () => {
    getLookups.mockResolvedValue({ status: 200, body: { lookups: {} } });
    const controller = new AbortController();

    await fetchFacultyLookups(controller.signal);

    expect(getLookups).toHaveBeenCalledTimes(1);
    expect(getLookups).toHaveBeenCalledWith(
      expect.objectContaining({ fetchOptions: { signal: controller.signal } }),
    );
  });
});
