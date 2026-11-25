import { beforeEach, describe, expect, it, vi } from "vitest";

const mockList = vi.fn();

vi.mock("@mms/fe-core/api/tsRest", () => ({
  apiContract: {
    students: {
      list: (...args: unknown[]) => mockList(...args),
    },
  },
  tsrClient: {},
}));

import { STUDENTS_MODULE_MANIFEST } from "@mms/contracts";
import { fetchAllStudentsForQuery } from "./useStudentsListQueries";

describe("fetchAllStudentsForQuery", () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it("surfaces the API error message instead of throwing a TypeError", async () => {
    mockList.mockResolvedValueOnce({
      status: 403,
      body: { type: "forbidden", message: "Insufficient permissions" },
    });

    await expect(fetchAllStudentsForQuery({})).rejects.toThrow("Insufficient permissions");
  });

  it("uses the real page-size cap in the safety error", async () => {
    mockList.mockResolvedValue({
      status: 200,
      body: { students: [], total: 1, hasMore: true },
    });

    await expect(fetchAllStudentsForQuery({})).rejects.toThrow(
      `${200 * STUDENTS_MODULE_MANIFEST.maxPageSize}-record`,
    );
  });
});
