import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWithTenantTransaction = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantTransaction(...args),
  withTenantRead: (...args: unknown[]) => mockWithTenantTransaction(...args),
}));

import { aggregateObligationsCommandMetrics } from "../db/repositories/obligationRepositoryMetrics.js";

function createChainableTx(rowsQueue: unknown[][]) {
  let queueIndex = 0;
  const makeNode = (): any => ({
    then: (resolve: (v: unknown) => void) => resolve(rowsQueue[queueIndex++] ?? []),
    from: () => makeNode(),
    where: () => makeNode(),
  });
  const tx = { select: vi.fn(() => makeNode()) };
  return { tx };
}

function runWithTx(tx: ReturnType<typeof createChainableTx>["tx"]) {
  mockWithTenantTransaction.mockImplementation(
    async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
  );
}

describe("obligationRepositoryMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero metrics snapshot when tenant is empty or whitespace", async () => {
    const result = await aggregateObligationsCommandMetrics("   ");
    expect(result).toEqual({
      total: 0,
      totalAmount: 0,
      cash: 0,
      online: 0,
      newThisPeriod: 0,
      obligationTypes: 0,
    });
    expect(mockWithTenantTransaction).not.toHaveBeenCalled();
  });

  it("aggregates collections and types accurately into snapshot", async () => {
    const { tx } = createChainableTx([
      [{ total: 10, totalAmount: 1500.5, cash: 6, online: 4, newThisPeriod: 3 }],
      [{ obligationTypes: 5 }],
    ]);
    runWithTx(tx);

    const result = await aggregateObligationsCommandMetrics("Demo", 14);

    expect(result).toEqual({
      total: 10,
      totalAmount: 1500.5,
      cash: 6,
      online: 4,
      newThisPeriod: 3,
      obligationTypes: 5,
    });
    expect(mockWithTenantTransaction).toHaveBeenCalledWith("demo", expect.any(Function));
    expect(tx.select).toHaveBeenCalledTimes(2);
  });

  it("handles empty or null row values safely", async () => {
    const { tx } = createChainableTx([[], []]);
    runWithTx(tx);

    const result = await aggregateObligationsCommandMetrics("demo");

    expect(result).toEqual({
      total: 0,
      totalAmount: 0,
      cash: 0,
      online: 0,
      newThisPeriod: 0,
      obligationTypes: 0,
    });
  });
});
