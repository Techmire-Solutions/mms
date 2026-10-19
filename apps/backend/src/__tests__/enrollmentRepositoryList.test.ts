import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listEnrollmentsPage,
  aggregateEnrollmentsCommandMetrics,
} from "../db/repositories/enrollmentRepositoryList.js";

const mockWithTenantTransaction = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantTransaction(...args),
  // Read paths now go through withTenantRead (read replica + read-only tx).
  withTenantRead: (...args: unknown[]) => mockWithTenantTransaction(...args),
}));

vi.mock("../db/repositories/enrollmentProjection.js", () => ({
  enrollmentRowToRecord: (row: Record<string, unknown>, timeline: unknown[] = []) => ({
    ...row,
    timeline,
  }),
  loadTimelineMapTx: async () => new Map(),
}));

function createSelectMock(selectQueue: unknown[][]) {
  let whereCalls = 0;
  const offset = vi.fn(async () => selectQueue.shift() ?? []);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => {
    whereCalls += 1;
    if (whereCalls === 1) {
      return Promise.resolve(selectQueue.shift() ?? []);
    }
    if (whereCalls === 3) {
      return Promise.resolve(selectQueue.shift() ?? []);
    }
    return { orderBy };
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select, where, orderBy, limit, offset };
}

describe("enrollmentRepositoryList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listEnrollmentsPage filters active rows and paginates", async () => {
    const selectQueue: unknown[][] = [
      [{ count: 2 }],
      [
        {
          id: "enr-1",
          studentName: "Ali",
          status: "confirmed",
          sessionId: "s1",
          deletedAt: null,
        },
      ],
      [],
    ];
    const { select } = createSelectMock(selectQueue);

    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { select: typeof select }) => Promise<unknown>) =>
        fn({ select }),
    );

    const result = await listEnrollmentsPage("Demo", {
      page: 1,
      limit: 1,
      status: "confirmed",
      sessionId: "s1",
      search: "ali",
    });

    expect(mockWithTenantTransaction).toHaveBeenCalledWith("demo", expect.any(Function));
    expect(select).toHaveBeenCalled();
    expect(result).toEqual({
      enrollments: [
        {
          id: "enr-1",
          studentName: "Ali",
          status: "confirmed",
          sessionId: "s1",
          deletedAt: null,
          timeline: [],
        },
      ],
      total: 2,
      page: 1,
      limit: 1,
      hasMore: true,
    });
  });

  it("listEnrollmentsPage scopes includeDeleted to deleted-only rows", async () => {
    const selectQueue: unknown[][] = [[{ count: 0 }], []];
    const { select, where } = createSelectMock(selectQueue);

    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { select: typeof select }) => Promise<unknown>) =>
        fn({ select }),
    );

    await listEnrollmentsPage("demo", { includeDeleted: true, page: 1, limit: 12 });

    expect(where).toHaveBeenCalled();
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("aggregateEnrollmentsCommandMetrics returns snapshot fields", async () => {
    const where = vi.fn(async () => [
      {
        total: 5,
        confirmed: 2,
        pending: 1,
        cancelled: 1,
        completed: 1,
        revenue: 150.5,
        newThisPeriod: 3,
      },
    ]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { select: typeof select }) => Promise<unknown>) =>
        fn({ select }),
    );

    const metrics = await aggregateEnrollmentsCommandMetrics("demo");

    expect(metrics).toEqual({
      total: 5,
      confirmed: 2,
      pending: 1,
      cancelled: 1,
      completed: 1,
      revenue: 150.5,
      newThisPeriod: 3,
    });
  });
});
