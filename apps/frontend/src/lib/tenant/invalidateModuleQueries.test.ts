import { describe, expect, it, vi, type Mock } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateModuleQueries } from "@/lib/tenant/invalidateModuleQueries";
import {
  FINANCE_FEE_STRUCTURES_QUERY_KEY,
  FINANCE_INVOICES_QUERY_KEY,
  FINANCE_METRICS_QUERY_KEY,
  FINANCE_PAYMENTS_QUERY_KEY,
} from "@/tenant/features/finance/hooks/financeQueryKeys";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/tenant/hooks/collections/dashboard";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";

interface QueryClientSpy {
  client: QueryClient;
  invalidateQueries: Mock;
}

function createQueryClientSpy(): QueryClientSpy {
  const invalidateQueries = vi.fn().mockResolvedValue(undefined);
  return {
    client: { invalidateQueries } as unknown as QueryClient,
    invalidateQueries,
  };
}

function invalidatedKeys(invalidateQueries: Mock): unknown[] {
  return invalidateQueries.mock.calls.map(([arg]) => (arg as { queryKey: unknown }).queryKey);
}

describe("invalidateModuleQueries", () => {
  it("given a finance_fee_structures live-push event, should invalidate the fee-structure and finance list keys when dispatched", () => {
    // Arrange
    const { client, invalidateQueries } = createQueryClientSpy();

    // Act
    invalidateModuleQueries(client, "finance_fee_structures");

    // Assert
    const keys = invalidatedKeys(invalidateQueries);
    expect(keys).toEqual(
      expect.arrayContaining([
        FINANCE_FEE_STRUCTURES_QUERY_KEY,
        FINANCE_INVOICES_QUERY_KEY,
        FINANCE_PAYMENTS_QUERY_KEY,
        FINANCE_METRICS_QUERY_KEY,
      ]),
    );
  });

  it("given a finance_metrics live-push event, should invalidate the finance metrics key when dispatched", () => {
    // Arrange
    const { client, invalidateQueries } = createQueryClientSpy();

    // Act
    invalidateModuleQueries(client, "finance_metrics");

    // Assert
    expect(invalidatedKeys(invalidateQueries)).toEqual(
      expect.arrayContaining([FINANCE_METRICS_QUERY_KEY, FINANCE_INVOICES_QUERY_KEY]),
    );
  });

  it("given an unrecognised collection key, should only invalidate dashboard aggregates when dispatched", () => {
    // Arrange
    const { client, invalidateQueries } = createQueryClientSpy();

    // Act
    expect(() => invalidateModuleQueries(client, "unknown_collection")).not.toThrow();

    // Assert
    expect(invalidatedKeys(invalidateQueries)).toEqual([
      DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
      DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
    ]);
  });
});
