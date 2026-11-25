import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectResult = [
    {
      total: 10,
      todo: 2,
      inProgress: 3,
      inReview: 1,
      blocked: 1,
      completed: 2,
      cancelled: 1,
      overdue: 1,
      priorityLow: 3,
      priorityMedium: 4,
      priorityHigh: 2,
      priorityUrgent: 1,
    },
  ];
  const where = vi.fn().mockResolvedValue(selectResult);
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return {
    selectResult,
    where,
    from,
    select,
  };
});

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenantRead: (
    _tenant: string,
    fn: (tx: { select: typeof mocks.select }) => Promise<unknown>,
  ) => fn({ select: mocks.select }),
}));

import { getTaskMetrics } from "../db/repositories/tasksMetricsRepository.js";

describe("tasksMetricsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates task metrics correctly", async () => {
    const metrics = await getTaskMetrics("test-tenant");
    expect(metrics.total).toBe(10);
    expect(metrics.todo).toBe(2);
    expect(metrics.inProgress).toBe(3);
    expect(metrics.byPriority.urgent).toBe(1);
    expect(metrics.byPriority.high).toBe(2);
    expect(mocks.select).toHaveBeenCalled();
  });
});
