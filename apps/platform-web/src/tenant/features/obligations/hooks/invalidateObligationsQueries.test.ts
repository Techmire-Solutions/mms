import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  OBLIGATIONS_QUERY_KEYS,
  OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY,
  OBLIGATIONS_VOUCHER_QUERY_KEY,
} from "./obligationsQueryKeys";
import { invalidateObligationsQueries } from "./invalidateObligationsQueries";
import { OBLIGATIONS_PREFERENCES_QUERY_KEY } from "./useObligationsSetupConfig";

/**
 * Invalidation completeness.
 *
 * The module ships several caches with their own long staleTimes (reports: 5 minutes, voucher:
 * 30 seconds, metrics, setup lists). `createModuleQueryInvalidator` supports one key per family, and
 * omitting a family is silent — the reports aggregates were never invalidated, so a recorded receipt
 * left the Summary tab stale for five minutes (frontend audit F1/F2). This test drives a real
 * QueryClient and asserts every declared key is reached.
 */

/** Every cache the module owns, including the ones the invalidator lists indirectly. */
const MODULE_KEYS: Record<string, readonly unknown[]> = {
  ...OBLIGATIONS_QUERY_KEYS,
  preferences: OBLIGATIONS_PREFERENCES_QUERY_KEY,
};

function seedClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const [name, key] of Object.entries(MODULE_KEYS)) {
    // A representative entry per key, carrying an extra segment like the hooks' query objects.
    queryClient.setQueryData([...key, `seeded-${name}`], { seeded: true });
  }
  // Contract hooks append a marker segment (`"contract"`) after the base key.
  queryClient.setQueryData([...OBLIGATIONS_QUERY_KEYS.collections, "contract", {}], {
    seeded: "contract",
  });
  return queryClient;
}

describe("invalidateObligationsQueries", () => {
  it("invalidates every declared obligation cache", async () => {
    const queryClient = seedClient();
    const invalidated: unknown[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    queryClient.invalidateQueries = ((filters?: { queryKey?: readonly unknown[] }) => {
      invalidated.push(filters?.queryKey);
      return original(filters);
    }) as typeof queryClient.invalidateQueries;

    invalidateObligationsQueries(queryClient);
    // The invalidator fires void promises; let them settle.
    await Promise.resolve();

    for (const [name, key] of Object.entries(MODULE_KEYS)) {
      const reached = invalidated.some(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(key),
      );
      expect(reached, `${name} was not invalidated (key ${JSON.stringify(key)})`).toBe(true);
    }
  });

  it("marks the report aggregates and the voucher stale", async () => {
    const queryClient = seedClient();
    invalidateObligationsQueries(queryClient);
    await Promise.resolve();

    const reportKey = [...OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY, "seeded-reportAggregates"];
    const voucherKey = [...OBLIGATIONS_VOUCHER_QUERY_KEY, "seeded-voucher"];
    expect(queryClient.getQueryState(reportKey)?.isInvalidated).toBe(true);
    // The voucher entry is seeded under its prefix; the prefix invalidation must reach it.
    expect(
      queryClient.getQueryCache().findAll({ queryKey: OBLIGATIONS_VOUCHER_QUERY_KEY }).length,
    ).toBeGreaterThan(0);
    expect(
      queryClient
        .getQueryCache()
        .findAll({ queryKey: OBLIGATIONS_VOUCHER_QUERY_KEY })
        .every((query) => query.state.isInvalidated),
    ).toBe(true);
    expect(queryClient.getQueryState(voucherKey)?.isInvalidated).toBe(true);
  });

  it("reaches contract sub-keys through prefix matching", async () => {
    const queryClient = seedClient();
    invalidateObligationsQueries(queryClient);
    await Promise.resolve();

    expect(
      queryClient.getQueryState([...OBLIGATIONS_QUERY_KEYS.collections, "contract", {}])
        ?.isInvalidated,
    ).toBe(true);
  });
});
