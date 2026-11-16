import { describe, expect, it } from "vitest";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";
import {
  ACCOUNTING_ENTRIES_QUERY_KEY,
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/hooks/collections/accounting";
import { OBLIGATIONS_VOUCHER_QUERY_KEY } from "./obligationsQueryKeys";
import { invalidateObligationsQueries } from "./invalidateObligationsQueries";

/** The invalidator only needs `invalidateQueries`; capture the key prefixes it asks for. */
function capture() {
  const keys: unknown[][] = [];
  const client = {
    invalidateQueries: (args: { queryKey: readonly unknown[] }) => {
      keys.push([...args.queryKey]);
      return Promise.resolve();
    },
  } as never;
  return { client, keys };
}

const equals = (key: readonly unknown[], target: readonly unknown[]) =>
  JSON.stringify(key) === JSON.stringify(target);

/**
 * Recording a receipt posts an accounting journal entry and moves the accounting
 * report aggregates; both caches keep long staleTimes and the dashboard summary is
 * a separate root. None of them were invalidated by an obligations write.
 */
describe("invalidateObligationsQueries cross-module keys", () => {
  it("invalidates the accounting entries and report aggregates", () => {
    const { client, keys } = capture();
    invalidateObligationsQueries(client);

    expect(keys.some((key) => equals(key, ACCOUNTING_ENTRIES_QUERY_KEY))).toBe(true);
    expect(keys.some((key) => equals(key, ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY))).toBe(true);
  });

  it("invalidates the dashboard summary root", () => {
    const { client, keys } = capture();
    invalidateObligationsQueries(client);

    expect(keys.some((key) => equals(key, DASHBOARD_SUMMARY_QUERY_KEY_ROOT))).toBe(true);
  });

  it("invalidates the accounting keys after lookups, not before", () => {
    const { client, keys } = capture();
    invalidateObligationsQueries(client);

    const lookups = keys.findIndex((key) => equals(key, OBLIGATIONS_VOUCHER_QUERY_KEY));
    const entries = keys.findIndex((key) => equals(key, ACCOUNTING_ENTRIES_QUERY_KEY));
    expect(lookups).toBeGreaterThanOrEqual(0);
    expect(entries).toBeGreaterThan(lookups);
  });
});
